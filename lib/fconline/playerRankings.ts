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

type Aggregate = {
  appearances: number;
  ratingSum: number;
  ratingCount: number;
  grades: Map<number, number>;
};

const API_BASE = "https://open.api.nexon.com/fconline/v1";
const OFFICIAL_MATCH_TYPE = 50;
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

  // 공식 문서상 목록은 기본적으로 최신순이며 orderby는 필수가 아닙니다.
  // 일부 현재 서버에서는 orderby가 OPENAPI00004(유효하지 않은 파라미터)를
  // 발생시키므로 필요한 파라미터만 전송합니다.
  const listUrl = `${API_BASE}/match?matchtype=${OFFICIAL_MATCH_TYPE}&offset=0&limit=${SAMPLE_MATCH_COUNT}`;
  const matchRows = await nexonFetch<MatchIdRow[]>(listUrl, apiKey);

  const matchIds = (matchRows ?? [])
    .map((row) => (typeof row === "string" ? row : row.matchId))
    .filter((id): id is string => Boolean(id));

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
  const gradeAggregate = new Map<string, { spid: number; grade: number; count: number }>();

  for (const detail of details) {
    for (const info of detail.matchInfo ?? []) {
      for (const player of info.player ?? []) {
        const spid = Number(player.spId);
        const grade = Number(player.spGrade ?? 1);
        const rating = Number(player.status?.spRating ?? 0);

        // 벤치/미출전 선수처럼 평점이 없는 항목은 실사용 집계에서 제외합니다.
        if (!Number.isFinite(spid) || spid <= 0 || !Number.isFinite(rating) || rating <= 0) {
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
