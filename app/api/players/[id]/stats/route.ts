import { NextResponse } from "next/server";
import { getPlayerStats } from "@/lib/fconline/playerStats";
import { getPlayerTeamColors } from "@/lib/fconline/teamColors";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const spid = Number(id);

  if (!Number.isFinite(spid)) {
    return NextResponse.json({ error: "invalid player id" }, { status: 400 });
  }

  const url = new URL(request.url);
  const parsedStrong = Number(url.searchParams.get("strong") ?? "1");
  const strong = Number.isFinite(parsedStrong)
    ? Math.min(13, Math.max(1, Math.trunc(parsedStrong)))
    : 1;
  const grow = Number(url.searchParams.get("grow")) === 5 ? 5 : 1;

  const [stats, teamColors] = await Promise.all([
    getPlayerStats(spid, strong, grow),
    getPlayerTeamColors(spid, strong),
  ]);

  if (!stats) {
    return NextResponse.json(
      { error: "FC Online player stats unavailable" },
      { status: 502 }
    );
  }

  return NextResponse.json({ stats, teamColors });
}
