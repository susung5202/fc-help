import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlayerOvrMap } from "@/lib/fconline/playerOvr";

const NEXON_BASE_URL = "https://open.api.nexon.com/fconline/v1";
const SPID_META_URL = "https://open.api.nexon.com/static/fconline/meta/spid.json";
const SEASON_META_URL = "https://open.api.nexon.com/static/fconline/meta/seasonid.json";
const POSITION_META_URL = "https://open.api.nexon.com/static/fconline/meta/spposition.json";
const OFFICIAL_1V1_MATCH_TYPE = 50;

type UserProfile = {
  fconline_nickname: string | null;
  fconline_ouid: string | null;
};

type NexonUserId = {
  ouid?: string;
};

type MatchListItem = string | { matchId?: unknown };

type MatchPlayer = {
  spId?: number;
  spPosition?: number;
  spGrade?: number;
};

type MatchInfo = {
  ouid?: string;
  nickname?: string;
  player?: MatchPlayer[];
};

type MatchDetail = {
  matchDate?: string;
  matchInfo?: MatchInfo[];
};

type PlayerMeta = {
  id: number;
  name: string;
};

type SeasonMeta = {
  seasonId: number;
  className: string;
  seasonImg: string;
};

type PositionMeta = {
  spposition: number;
  desc: string;
};

export const maxDuration = 60;

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

async function metaFetch<T>(url: string): Promise<T> {
  const response = await fetch(url, { next: { revalidate: 86400 } });
  if (!response.ok) throw new Error(`META_${response.status}`);
  return response.json() as Promise<T>;
}

function getMatchId(item: MatchListItem | undefined) {
  if (typeof item === "string") return item;
  if (item && typeof item === "object" && item.matchId != null) return String(item.matchId);
  return "";
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!accessToken) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "FC Online API 키가 서버에 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  try {
    const admin = createAdminClient();
    const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return NextResponse.json({ error: "로그인 정보를 확인할 수 없습니다." }, { status: 401 });
    }

    const { data: profileData, error: profileError } = await admin
      .from("profiles")
      .select("fconline_nickname,fconline_ouid")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    const profile = profileData as UserProfile | null;
    const nickname = profile?.fconline_nickname?.trim() ?? "";
    if (!nickname) {
      return NextResponse.json(
        { error: "마이페이지에서 FC Online 닉네임을 먼저 연결해주세요." },
        { status: 400 }
      );
    }

    let ouid = profile?.fconline_ouid?.trim() ?? "";
    if (!ouid) {
      const idData = await nexonFetch<NexonUserId>(
        `${NEXON_BASE_URL}/id?nickname=${encodeURIComponent(nickname)}`,
        apiKey
      );
      ouid = idData.ouid ?? "";
    }

    if (!ouid) {
      return NextResponse.json({ error: "연결된 FC Online 구단주를 찾을 수 없습니다." }, { status: 404 });
    }

    const matches = await nexonFetch<MatchListItem[]>(
      `${NEXON_BASE_URL}/user/match?ouid=${encodeURIComponent(ouid)}&matchtype=${OFFICIAL_1V1_MATCH_TYPE}&offset=0&limit=1`,
      apiKey
    );
    const matchId = getMatchId(Array.isArray(matches) ? matches[0] : undefined);

    if (!matchId) {
      return NextResponse.json(
        { error: "최근 1대1 공식경기 기록이 없어 스쿼드를 불러올 수 없습니다." },
        { status: 404 }
      );
    }

    const [detail, playerMeta, seasonMeta, positionMeta] = await Promise.all([
      nexonFetch<MatchDetail>(
        `${NEXON_BASE_URL}/match-detail?matchid=${encodeURIComponent(matchId)}`,
        apiKey
      ),
      metaFetch<PlayerMeta[]>(SPID_META_URL),
      metaFetch<SeasonMeta[]>(SEASON_META_URL),
      metaFetch<PositionMeta[]>(POSITION_META_URL),
    ]);

    const mine = (detail.matchInfo ?? []).find(
      (info) => info.ouid === ouid || info.nickname === nickname
    );
    if (!mine) {
      return NextResponse.json({ error: "최근 경기의 구단주 정보를 확인할 수 없습니다." }, { status: 502 });
    }

    const positionMap = new Map(
      (Array.isArray(positionMeta) ? positionMeta : []).map((item) => [Number(item.spposition), item.desc])
    );
    const starters = (mine.player ?? [])
      .map((player) => ({
        spid: Number(player.spId),
        grade: Math.max(1, Math.min(13, Number(player.spGrade) || 1)),
        slotPosition: positionMap.get(Number(player.spPosition)) ?? "",
      }))
      .filter(
        (player) =>
          Number.isFinite(player.spid) &&
          player.spid > 0 &&
          player.slotPosition &&
          player.slotPosition !== "SUB"
      )
      .slice(0, 11);

    if (starters.length < 11 || !starters.some((player) => player.slotPosition === "GK")) {
      return NextResponse.json(
        { error: "최근 경기의 선발 11명 정보를 완전히 불러오지 못했습니다." },
        { status: 502 }
      );
    }

    const playerMap = new Map((Array.isArray(playerMeta) ? playerMeta : []).map((item) => [Number(item.id), item]));
    const seasonMap = new Map((Array.isArray(seasonMeta) ? seasonMeta : []).map((item) => [Number(item.seasonId), item]));
    const ovrMap = await getPlayerOvrMap(starters.map((player) => player.spid));

    const players = starters.map((starter) => {
      const meta = playerMap.get(starter.spid);
      const season = seasonMap.get(Math.floor(starter.spid / 1_000_000));
      const ovrInfo = ovrMap.get(starter.spid) ?? null;

      return {
        id: starter.spid,
        name: meta?.name ?? `선수 ${starter.spid}`,
        seasonName: season?.className ?? "시즌 미확인",
        seasonImg: season?.seasonImg ?? null,
        ovr: ovrInfo?.ovr ?? null,
        position: ovrInfo?.position ?? starter.slotPosition,
        slotPosition: starter.slotPosition,
        newTraits: ovrInfo?.newTraits ?? [],
        grade: starter.grade,
        artworkSpid: starter.spid,
      };
    });

    return NextResponse.json(
      {
        source: "latest_official_match",
        nickname: mine.nickname ?? nickname,
        matchId,
        matchType: OFFICIAL_1V1_MATCH_TYPE,
        matchTypeName: "1대1 공식경기",
        matchDate: detail.matchDate ?? null,
        players,
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("FC Online squad import failed", error);
    const message = error instanceof Error ? error.message : "";
    const statusMatch = message.match(/^NEXON_(\d+):/);
    const nexonStatus = statusMatch ? Number(statusMatch[1]) : 0;

    if (nexonStatus === 400 || nexonStatus === 404) {
      return NextResponse.json({ error: "FC Online 최근 경기 정보를 찾을 수 없습니다." }, { status: 404 });
    }
    if (nexonStatus === 429) {
      return NextResponse.json({ error: "FC Online 조회 요청이 많습니다. 잠시 후 다시 시도해주세요." }, { status: 429 });
    }

    return NextResponse.json({ error: "FC Online 스쿼드를 불러오지 못했습니다." }, { status: 502 });
  }
}
