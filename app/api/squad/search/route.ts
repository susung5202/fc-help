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

async function getPlayers(): Promise<Player[]> {
  const response = await fetch(
    "https://open.api.nexon.com/static/fconline/meta/spid.json",
    { next: { revalidate: 86400 } }
  );

  if (!response.ok) throw new Error("player metadata request failed");
  return response.json();
}

async function getSeasons(): Promise<Season[]> {
  const response = await fetch(
    "https://open.api.nexon.com/static/fconline/meta/seasonid.json",
    { next: { revalidate: 86400 } }
  );

  if (!response.ok) throw new Error("season metadata request failed");
  return response.json();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  if (query.length < 1) {
    return NextResponse.json({ items: [] });
  }

  try {
    const [players, seasons] = await Promise.all([getPlayers(), getSeasons()]);
    const seasonMap = new Map(
      seasons.map((season) => [Number(season.seasonId), season])
    );

    const matched = players
      .filter((player) =>
        player.name.toLowerCase().includes(query.toLowerCase())
      )
      .sort((a, b) => b.id - a.id)
      .slice(0, 24);

    const ovrMap = await getPlayerOvrMap(matched.map((player) => player.id));

    const items = matched
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

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Squad player search failed", error);
    return NextResponse.json(
      { error: "선수 검색에 실패했습니다." },
      { status: 500 }
    );
  }
}
