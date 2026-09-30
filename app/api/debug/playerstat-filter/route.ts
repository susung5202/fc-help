import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function GET() {
  try {
    const response = await fetch("https://fconline.nexon.com/DataCenter/PlayerStat", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
      cache: "no-store",
    });
    const html = await response.text();
    const snippets: string[] = [];
    const regex = /teamcolor|teamColor|TeamColor|strTeam|color/i;
    for (let index = 0; index < html.length; ) {
      const match = regex.exec(html.slice(index));
      if (!match) break;
      const at = index + (match.index ?? 0);
      snippets.push(html.slice(Math.max(0, at - 500), Math.min(html.length, at + 900)));
      index = at + Math.max(1, match[0].length);
      if (snippets.length >= 20) break;
    }
    return NextResponse.json({ status: response.status, snippets });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}
