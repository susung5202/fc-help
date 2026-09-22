import { NextResponse } from "next/server";
import { getPlayerOvrMap } from "@/lib/fconline/playerOvr";

type Player = {
  id: number;
  name: string;
};

type Season = {
  seasonId: number;
  className: string;
  seasonImg: string;
};

type SearchItem = {
  id: number;
  name: string;
  seasonName: string;
  seasonImg: string | null;
  ovr: number | null;
  position: string | null;
  newTraits: string[];
};

type CachedSearch = {
  expiresAt: number;
  items: SearchItem[];
};

export const maxDuration = 60;

let playersPromise: Promise<Player[]> | null = null;
let seasonsPromise: Promise<Season[]> | null = null;
const searchCache = new Map<string, CachedSearch>();
const META_CACHE_MS = 24 * 60 * 60 * 1000;
const SEARCH_CACHE_MS = 6 * 60 * 60 * 1000;
let playerMetaExpiresAt = 0;
let seasonMetaExpiresAt = 0;

async function getPlayers(): Promise<Player[]> {
  if (playersPromise && Date.now() < playerMetaExpiresAt) return playersPromise;

  playersPromise = fetch("https://open.api.nexon.com/static/fconline/meta/spid.json", {
    cache: "no-store",
  })
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

async function getSeasons(): Promise<Season[]> {
  if (seasonsPromise && Date.now() < seasonMetaExpiresAt) return seasonsPromise;

  seasonsPromise = fetch("https://open.api.nexon.com/static/fconline/meta/seasonid.json", {
    cache: "no-store",
  })
    .then((response) => {
      if (!response.ok) throw new Error("season metadata request failed");
      return response.json() as Promise<Season[]>;
    })
    .catch((error) => {
      seasonsPromise = null;
      throw error;
    });
  seasonMetaExpiresAt = Date.now() + META_CACHE_MS;

  return seasonsPromise;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  if (query.length < 1) {
    return NextResponse.json({ items: [] });
  }

  const normalizedQuery = query.toLocaleLowerCase("ko-KR");
  const cached = searchCache.get(normalizedQuery);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(
      { items: cached.items },
      { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } }
    );
  }

  try {
    const startedAt = Date.now();
    const [players, seasons] = await Promise.all([getPlayers(), getSeasons()]);
    const seasonMap = new Map(
      seasons.map((season) => [Number(season.seasonId), season])
    );

    const allMatches = players
      .filter((player) =>
        player.name.toLocaleLowerCase("ko-KR").includes(normalizedQuery)
      )
      .sort((a, b) => b.id - a.id);

    const exactMatches = allMatches.filter(
      (player) => player.name.toLocaleLowerCase("ko-KR") === normalizedQuery
    );

    // Exact player-name searches should expose every season, including old classes
    // such as EBS. Partial-name searches stay bounded so broad queries do not become
    // unnecessarily expensive.
    const matched = exactMatches.length > 0 ? exactMatches : allMatches.slice(0, 30);

    const ovrMap = await getPlayerOvrMap(matched.map((player) => player.id));

    const items: SearchItem[] = matched
      .map((player) => {
        const season = seasonMap.get(Math.floor(player.id / 1_000_000));
        const ovr = ovrMap.get(player.id) ?? null;

        return {
          id: player.id,
          name: player.name,
          seasonName: season?.className ?? "시즌 미확인",
          seasonImg: season?.seasonImg ?? null,
          ovr: ovr?.ovr ?? null,
          position: ovr?.position ?? null,
          newTraits: ovr?.newTraits ?? [],
        };
      })
      .sort((a, b) => (b.ovr ?? -1) - (a.ovr ?? -1));

    searchCache.set(normalizedQuery, {
      expiresAt: Date.now() + SEARCH_CACHE_MS,
      items,
    });

    console.info("Squad player search completed", {
      query: normalizedQuery,
      count: items.length,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } }
    );
  } catch (error) {
    console.error("Squad player search failed", error);
    return NextResponse.json(
      { error: "선수 검색에 실패했습니다." },
      { status: 500 }
    );
  }
}
