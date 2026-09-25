import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const NEXON_BASE_URL = "https://open.api.nexon.com/fconline/v1";
const DIVISION_META_URL = "https://open.api.nexon.com/static/fconline/meta/division.json";
const OFFICIAL_1V1_MATCH_TYPE = 50;

type NexonUserId = {
  ouid?: string;
};

type NexonUserBasic = {
  ouid?: string;
  nickname?: string;
  level?: number;
};

type MaxDivision = {
  matchType?: number;
  division?: number;
  achievementDate?: string;
};

type DivisionMeta = {
  divisionId?: number | string;
  divisionName?: string;
};

type MatchInfo = {
  ouid?: string;
  nickname?: string;
  division?: number | string;
  divisionId?: number | string;
  matchDetail?: {
    division?: number | string;
    divisionId?: number | string;
  };
};

type MatchDetail = {
  matchDate?: string;
  matchInfo?: MatchInfo[];
};

function getApiKey() {
  return (
    process.env.NEXON_OPEN_API_KEY ||
    process.env.NEXON_API_KEY ||
    process.env.NEXON_FCONLINE_API_KEY ||
    process.env.FC_ONLINE_API_KEY ||
    ""
  );
}

async function nexonFetch<T>(url: string, apiKey: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "x-nxopen-api-key": apiKey,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`NEXON_${response.status}:${detail.slice(0, 160)}`);
  }

  return response.json() as Promise<T>;
}

function toDivisionId(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readMatchDivision(info: MatchInfo | undefined) {
  if (!info) return null;
  const candidates = [
    info.division,
    info.divisionId,
    info.matchDetail?.division,
    info.matchDetail?.divisionId,
  ];

  for (const candidate of candidates) {
    const parsed = toDivisionId(candidate);
    if (parsed != null) return parsed;
  }
  return null;
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!accessToken) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.getUser(accessToken);
    if (error || !data.user) {
      return NextResponse.json({ error: "로그인 정보를 확인할 수 없습니다." }, { status: 401 });
    }
  } catch (error) {
    console.error("FC Online profile auth check failed", error);
    return NextResponse.json({ error: "로그인 확인에 실패했습니다." }, { status: 500 });
  }

  const url = new URL(request.url);
  const nickname = (url.searchParams.get("nickname") ?? "").trim();
  if (!nickname || nickname.length > 30) {
    return NextResponse.json({ error: "FC Online 닉네임을 확인해주세요." }, { status: 400 });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "FC Online API 키가 서버에 설정되지 않았습니다.",
        code: "NEXON_API_KEY_MISSING",
      },
      { status: 503 }
    );
  }

  try {
    const idUrl = `${NEXON_BASE_URL}/id?nickname=${encodeURIComponent(nickname)}`;
    const userId = await nexonFetch<NexonUserId>(idUrl, apiKey);
    if (!userId.ouid) {
      return NextResponse.json({ error: "해당 FC Online 구단주를 찾을 수 없습니다." }, { status: 404 });
    }

    const ouid = userId.ouid;
    const headersKey = apiKey;
    const [basic, matches, maxDivisions, divisionMeta] = await Promise.all([
      nexonFetch<NexonUserBasic>(
        `${NEXON_BASE_URL}/user/basic?ouid=${encodeURIComponent(ouid)}`,
        headersKey
      ),
      nexonFetch<unknown[]>(
        `${NEXON_BASE_URL}/user/match?ouid=${encodeURIComponent(ouid)}&matchtype=${OFFICIAL_1V1_MATCH_TYPE}&offset=0&limit=1`,
        headersKey
      ),
      nexonFetch<MaxDivision[]>(
        `${NEXON_BASE_URL}/user/maxdivision?ouid=${encodeURIComponent(ouid)}`,
        headersKey
      ),
      nexonFetch<DivisionMeta[]>(DIVISION_META_URL, headersKey),
    ]);

    const divisionMap = new Map<number, string>();
    for (const item of Array.isArray(divisionMeta) ? divisionMeta : []) {
      const id = toDivisionId(item.divisionId);
      if (id != null && item.divisionName) divisionMap.set(id, item.divisionName);
    }

    const firstMatch = Array.isArray(matches) ? matches[0] : null;
    const latestMatchId =
      typeof firstMatch === "string"
        ? firstMatch
        : firstMatch && typeof firstMatch === "object" && "matchId" in firstMatch
          ? String((firstMatch as { matchId?: unknown }).matchId ?? "")
          : "";

    let divisionId: number | null = null;
    let tierSource: "latest_match" | "historical_best" | null = null;
    let lastMatchDate: string | null = null;

    if (latestMatchId) {
      const detail = await nexonFetch<MatchDetail>(
        `${NEXON_BASE_URL}/match-detail?matchid=${encodeURIComponent(latestMatchId)}`,
        headersKey
      );
      const mine = (detail.matchInfo ?? []).find(
        (info) => info.ouid === ouid || info.nickname === basic.nickname
      );
      divisionId = readMatchDivision(mine);
      lastMatchDate = detail.matchDate ?? null;
      if (divisionId != null) tierSource = "latest_match";
    }

    if (divisionId == null) {
      const best = (Array.isArray(maxDivisions) ? maxDivisions : []).find(
        (item) => Number(item.matchType) === OFFICIAL_1V1_MATCH_TYPE
      );
      const fallbackDivision = toDivisionId(best?.division);
      if (fallbackDivision != null) {
        divisionId = fallbackDivision;
        tierSource = "historical_best";
      }
    }

    return NextResponse.json(
      {
        ouid,
        nickname: basic.nickname ?? nickname,
        level: Number.isFinite(Number(basic.level)) ? Number(basic.level) : null,
        divisionId,
        divisionName: divisionId == null ? null : divisionMap.get(divisionId) ?? `등급 ${divisionId}`,
        tierSource,
        lastMatchDate,
        matchType: OFFICIAL_1V1_MATCH_TYPE,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error("FC Online profile lookup failed", error);
    const message = error instanceof Error ? error.message : "";
    const statusMatch = message.match(/^NEXON_(\d+):/);
    const nexonStatus = statusMatch ? Number(statusMatch[1]) : 0;

    if (nexonStatus === 400 || nexonStatus === 404) {
      return NextResponse.json({ error: "해당 FC Online 구단주를 찾을 수 없습니다." }, { status: 404 });
    }
    if (nexonStatus === 429) {
      return NextResponse.json({ error: "FC Online 조회 요청이 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
    }

    return NextResponse.json({ error: "FC Online 정보를 불러오지 못했습니다." }, { status: 502 });
  }
}
