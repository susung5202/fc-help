import { NextResponse } from "next/server";

type Player = {
  id: number;
  name: string;
};

type TeamColorPlayer = {
  name: string;
  sampleSpid: number;
  seasonCount: number;
};

type CachedResult = {
  expiresAt: number;
  items: TeamColorPlayer[];
};

const PLAYER_LIST_URL = "https://fconline.nexon.com/datacenter/PlayerList";
const PLAYER_META_URL = "https://open.api.nexon.com/static/fconline/meta/spid.json";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const CACHE_MS = 30 * 60 * 1000;
const META_CACHE_MS = 24 * 60 * 60 * 1000;
const resultCache = new Map<string, CachedResult>();
let playersPromise: Promise<Player[]> | null = null;
let playerMetaExpiresAt = 0;

export const maxDuration = 60;

async function getPlayers() {
  if (playersPromise && Date.now() < playerMetaExpiresAt) return playersPromise;

  playersPromise = fetch(PLAYER_META_URL, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("player metadata request failed");
      return response.json() as Promise<Player[]>;
    })
    .catch((error) => {
      playersPromise = null;
      throw error;
    });
  playerMetaExpiresAt = Date.now() + META_CACHE_MS;
  return playersPromise;
}

function buildPlayerListParams(
  query: string,
  teamColor: string,
  mode: "club" | "nation" | "teamcolor"
) {
  const params = new URLSearchParams({
    strPlayerName: query,
    strSeason: "",
    strPosition: "",
    n4SalaryMin: "0",
    n4SalaryMax: "99",
    n4OvrMin: "0",
    n4OvrMax: "200",
    n4PageNo: "1",
    strTeamName: "",
    strNationName: "",
    strTeamColorName: "",
  });

  if (mode === "club") params.set("strTeamName", teamColor);
  if (mode === "nation") params.set("strNationName", teamColor);
  if (mode === "teamcolor") params.set("strTeamColorName", teamColor);
  return params;
}

function parseSpids(html: string) {
  const ids = new Set<number>();
  const patterns = [
    /\.val\(['"]?(\d+)['"]?\)/gi,
    /PlayerInfo\?spid=(\d+)/gi,
    /\bspid[=:]['"]?(\d+)/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const spid = Number(match[1]);
      if (Number.isInteger(spid) && spid > 0) ids.add(spid);
      if (ids.size >= 120) return Array.from(ids);
    }
  }
  return Array.from(ids);
}

async function fetchFilteredSpids(query: string, teamColor: string) {
  const headers = {
    Accept: "text/html, */*; q=0.01",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "User-Agent": USER_AGENT,
    "X-Requested-With": "XMLHttpRequest",
    Referer: "https://fconline.nexon.com/DataCenter/PlayerStat",
    Origin: "https://fconline.nexon.com",
  };

  const modes = ["club", "nation", "teamcolor"] as const;
  const responses = await Promise.all(
    modes.map(async (mode) => {
      const response = await fetch(PLAYER_LIST_URL, {
        method: "POST",
        headers,
        body: buildPlayerListParams(query, teamColor, mode),
        cache: "no-store",
      });
      if (!response.ok) return [] as number[];
      return parseSpids(await response.text());
    })
  );

  return Array.from(new Set(responses.flat())).slice(0, 120);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamColor = (searchParams.get("teamColor") ?? "").trim();
  const query = (searchParams.get("q") ?? "").trim();

  if (teamColor.length < 2) {
    return NextResponse.json({ items: [] });
  }

  if (teamColor.length > 40 || query.length > 40) {
    return NextResponse.json({ error: "검색어가 너무 깁니다." }, { status: 400 });
  }

  const cacheKey = `${teamColor.toLocaleLowerCase("ko-KR")}|${query.toLocaleLowerCase("ko-KR")}`;
  const cached = resultCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(
      { items: cached.items },
      { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } }
    );
  }

  try {
    const [players, spids] = await Promise.all([
      getPlayers(),
      fetchFilteredSpids(query, teamColor),
    ]);
    const playerMap = new Map(players.map((player) => [player.id, player]));
    const grouped = new Map<string, TeamColorPlayer>();

    for (const spid of spids) {
      const player = playerMap.get(spid);
      if (!player) continue;
      if (query && !player.name.toLocaleLowerCase("ko-KR").includes(query.toLocaleLowerCase("ko-KR"))) {
        continue;
      }

      const current = grouped.get(player.name);
      if (current) {
        current.seasonCount += 1;
        if (spid > current.sampleSpid) current.sampleSpid = spid;
      } else {
        grouped.set(player.name, {
          name: player.name,
          sampleSpid: spid,
          seasonCount: 1,
        });
      }
    }

    const items = Array.from(grouped.values())
      .sort((a, b) => b.seasonCount - a.seasonCount || a.name.localeCompare(b.name, "ko-KR"))
      .slice(0, 40);

    resultCache.set(cacheKey, { expiresAt: Date.now() + CACHE_MS, items });

    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } }
    );
  } catch (error) {
    console.error("Squad team color search failed", error);
    return NextResponse.json(
      { error: "팀컬러 선수 검색에 실패했습니다." },
      { status: 500 }
    );
  }
}
