export type PlayerRankingItem = {
  spid: number;
  grade: number;
  metric: number;
};

export type PlayerRankings = {
  popular: PlayerRankingItem[];
  rating: PlayerRankingItem[];
  grade: PlayerRankingItem[];
};

type MatchIdRow = string | { matchId?: string };

type MatchPlayer = {
  spId?: number;
  spGrade?: number;
  status?: {
    spRating?: number;
  };
};

type MatchInfo = {
  player?: MatchPlayer[];
};

type MatchDetail = {
  matchInfo?: MatchInfo[];
};

type MatchTypeMeta = {
  matchtype?: number;
  desc?: string;
};

type Aggregate = {
  appearances: number;
  ratingSum: number;
  ratingCount: number;
  grades: Map<number, number>;
};

const API_BASE = "https://open.api.nexon.com/fconline/v1";
const MATCH_TYPE_META_URL =
  "https://open.api.nexon.com/static/fconline/meta/matchtype.json";
const SAMPLE_MATCH_COUNT = 40;

async function nexonFetch<T>(url: string, apiKey: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "x-nxopen-api-key": apiKey },
      next: { revalidate: 1800 },
    });

    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function parseMatchIds(rows: unknown, limit: number) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      if (typeof row === "string") return row;
      if (row && typeof row === "object" && "matchId" in row) {
        return String((row as { matchId?: unknown }).matchId ?? "");
      }
      return "";
    })
    .filter((id): id is string => Boolean(id))
    .slice(0, limit);
}

async function getOfficialMatchTypeCandidates(apiKey: string) {
  const meta = await nexonFetch<MatchTypeMeta[]>(MATCH_TYPE_META_URL, apiKey);
  const candidates: string[] = [];

  if (Array.isArray(meta)) {
    const rows = meta
      .filter((row) => Number.isFinite(Number(row.matchtype)))
      .map((row) => ({
        matchtype: String(Number(row.matchtype)),
        desc: String(row.desc ?? "").trim(),
      }));

    // 메타데이터의 현재 공식경기 값을 우선 사용한다.
    for (const row of rows) {
      if (row.desc === "공식경기") candidates.push(row.matchtype);
    }

    for (const row of rows) {
      if (
        row.desc.includes("공식경기") &&
        !row.desc.includes("감독") &&
        !row.desc.includes("볼타")
      ) {
        candidates.push(row.matchtype);
      }
    }
  }

  // 메타데이터 조회가 잠시 실패해도 과거/문서 예시 값을 순차 시도한다.
  candidates.push("50", "52");
  return [...new Set(candidates)];
}

async function getRecentMatchIds(apiKey: string, limit: number) {
  const matchTypes = await getOfficialMatchTypeCandidates(apiKey);

  for (const matchtype of matchTypes) {
    const encoded = encodeURIComponent(matchtype);
    const requests = [
      `${API_BASE}/match?matchtype=${encoded}&offset=0&limit=${limit}`,
      `${API_BASE}/match?matchtype=${encoded}&limit=${limit}`,
      `${API_BASE}/match?matchtype=${encoded}`,
    ];

    for (const url of requests) {
      const rows = await nexonFetch<MatchIdRow[]>(url, apiKey);
      const ids = parseMatchIds(rows, limit);
      if (ids.length > 0) return ids;
    }
  }

  return [];
}

function mostUsedGrade(grades: Map<number, number>) {
  let bestGrade = 1;
  let bestCount = -1;

  for (const [grade, count] of grades) {
    if (count > bestCount || (count === bestCount && grade > bestGrade)) {
      bestGrade = grade;
      bestCount = count;
    }
  }

  return bestGrade;
}

export async function getPlayerRankings(): Promise<PlayerRankings> {
  const apiKey = process.env.NEXON_API_KEY;
  if (!apiKey) return { popular: [], rating: [], grade: [] };

  const matchIds = await getRecentMatchIds(apiKey, SAMPLE_MATCH_COUNT);

  if (matchIds.length === 0) {
    return { popular: [], rating: [], grade: [] };
  }

  const details: MatchDetail[] = [];

  // API 호출을 한 번에 과도하게 몰지 않도록 작은 묶음으로 처리합니다.
  for (let i = 0; i < matchIds.length; i += 8) {
    const chunk = matchIds.slice(i, i + 8);
    const rows = await Promise.all(
      chunk.map((matchId) =>
        nexonFetch<MatchDetail>(
          `${API_BASE}/match-detail?matchid=${encodeURIComponent(matchId)}`,
          apiKey
        )
      )
    );
    details.push(...rows.filter((row): row is MatchDetail => Boolean(row)));
  }

  const aggregate = new Map<number, Aggregate>();
  const gradeAggregate = new Map<
    string,
    { spid: number; grade: number; count: number }
  >();

  for (const detail of details) {
    for (const info of detail.matchInfo ?? []) {
      for (const player of info.player ?? []) {
        const spid = Number(player.spId);
        const grade = Number(player.spGrade ?? 1);
        const rating = Number(player.status?.spRating ?? 0);

        // 벤치/미출전 선수처럼 평점이 없는 항목은 실사용 집계에서 제외합니다.
        if (
          !Number.isFinite(spid) ||
          spid <= 0 ||
          !Number.isFinite(rating) ||
          rating <= 0
        ) {
          continue;
        }

        const current = aggregate.get(spid) ?? {
          appearances: 0,
          ratingSum: 0,
          ratingCount: 0,
          grades: new Map<number, number>(),
        };

        current.appearances += 1;
        current.ratingSum += rating;
        current.ratingCount += 1;
        current.grades.set(grade, (current.grades.get(grade) ?? 0) + 1);
        aggregate.set(spid, current);

        const gradeKey = `${spid}:${grade}`;
        const gradeCurrent = gradeAggregate.get(gradeKey) ?? {
          spid,
          grade,
          count: 0,
        };
        gradeCurrent.count += 1;
        gradeAggregate.set(gradeKey, gradeCurrent);
      }
    }
  }

  const popular = [...aggregate.entries()]
    .sort((a, b) => b[1].appearances - a[1].appearances)
    .slice(0, 5)
    .map(([spid, row]) => ({
      spid,
      grade: mostUsedGrade(row.grades),
      metric: row.appearances,
    }));

  const rating = [...aggregate.entries()]
    .filter(([, row]) => row.ratingCount >= 3)
    .sort((a, b) => {
      const aRating = a[1].ratingSum / a[1].ratingCount;
      const bRating = b[1].ratingSum / b[1].ratingCount;
      return bRating - aRating || b[1].ratingCount - a[1].ratingCount;
    })
    .slice(0, 5)
    .map(([spid, row]) => ({
      spid,
      grade: mostUsedGrade(row.grades),
      metric: Number((row.ratingSum / row.ratingCount).toFixed(2)),
    }));

  const grade = [...gradeAggregate.values()]
    .sort((a, b) => b.count - a.count || b.grade - a.grade)
    .slice(0, 5)
    .map((row) => ({
      spid: row.spid,
      grade: row.grade,
      metric: row.count,
    }));

  return { popular, rating, grade };
}
