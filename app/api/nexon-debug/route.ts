import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.NEXON_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, step: "env", hasKey: false });
  }

  const headers = { "x-nxopen-api-key": apiKey };
  const listUrl = "https://open.api.nexon.com/fconline/v1/match?matchtype=50&offset=0&limit=3";

  try {
    const listRes = await fetch(listUrl, { headers, cache: "no-store" });
    const listText = await listRes.text();
    let listBody: unknown;
    try {
      listBody = JSON.parse(listText);
    } catch {
      listBody = listText.slice(0, 500);
    }

    if (!listRes.ok) {
      return NextResponse.json({
        ok: false,
        step: "match-list",
        hasKey: true,
        request: "matchtype=50&offset=0&limit=3",
        status: listRes.status,
        body: listBody,
      });
    }

    const ids = Array.isArray(listBody)
      ? listBody
          .map((row) => (typeof row === "string" ? row : (row as { matchId?: string })?.matchId))
          .filter(Boolean)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({
        ok: false,
        step: "match-list-empty",
        hasKey: true,
        status: listRes.status,
        body: listBody,
      });
    }

    const detailUrl = `https://open.api.nexon.com/fconline/v1/match-detail?matchid=${encodeURIComponent(String(ids[0]))}`;
    const detailRes = await fetch(detailUrl, { headers, cache: "no-store" });
    const detailText = await detailRes.text();
    let detailBody: unknown;
    try {
      detailBody = JSON.parse(detailText);
    } catch {
      detailBody = detailText.slice(0, 500);
    }

    return NextResponse.json({
      ok: detailRes.ok,
      step: "match-detail",
      hasKey: true,
      listStatus: listRes.status,
      listCount: ids.length,
      detailStatus: detailRes.status,
      detailTopLevelKeys:
        detailBody && typeof detailBody === "object" && !Array.isArray(detailBody)
          ? Object.keys(detailBody as Record<string, unknown>)
          : null,
      detailHasMatchInfo:
        !!detailBody &&
        typeof detailBody === "object" &&
        !Array.isArray(detailBody) &&
        Array.isArray((detailBody as { matchInfo?: unknown }).matchInfo),
      detailBody: detailRes.ok ? undefined : detailBody,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      step: "fetch-exception",
      hasKey: true,
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}
