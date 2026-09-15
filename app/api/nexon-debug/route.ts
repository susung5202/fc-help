import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type MatchTypeMeta = {
  matchtype?: number;
  desc?: string;
};

type MatchIdRow = string | { matchId?: string };

function parseMatchIds(rows: unknown) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => {
      if (typeof row === "string") return row;
      if (row && typeof row === "object" && "matchId" in row) {
        return String((row as { matchId?: unknown }).matchId ?? "");
      }
      return "";
    })
    .filter(Boolean);
}

export async function GET() {
  const apiKey = process.env.NEXON_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, step: "env", hasKey: false });
  }

  const headers = { "x-nxopen-api-key": apiKey };
  const metaUrl =
    "https://open.api.nexon.com/static/fconline/meta/matchtype.json";

  try {
    const metaRes = await fetch(metaUrl, { headers, cache: "no-store" });
    const metaBody = (await metaRes.json().catch(() => [])) as MatchTypeMeta[];

    const officialRows = Array.isArray(metaBody)
      ? metaBody.filter((row) => String(row.desc ?? "").includes("공식경기"))
      : [];

    const candidates = [
      ...officialRows.map((row) => String(Number(row.matchtype))),
      "50",
      "52",
    ].filter((value, index, array) => value !== "NaN" && array.indexOf(value) === index);

    const attempts: Array<{
      matchtype: string;
      query: string;
      status: number;
      count: number;
      error?: unknown;
    }> = [];

    for (const matchtype of candidates) {
      const encoded = encodeURIComponent(matchtype);
      const queries = [
        `matchtype=${encoded}&offset=0&limit=3`,
        `matchtype=${encoded}&limit=3`,
        `matchtype=${encoded}`,
      ];

      for (const query of queries) {
        const listRes = await fetch(
          `https://open.api.nexon.com/fconline/v1/match?${query}`,
          { headers, cache: "no-store" }
        );
        const text = await listRes.text();
        let body: unknown;
        try {
          body = JSON.parse(text);
        } catch {
          body = text.slice(0, 500);
        }

        const ids = parseMatchIds(body);
        attempts.push({
          matchtype,
          query,
          status: listRes.status,
          count: ids.length,
          error: listRes.ok ? undefined : body,
        });

        if (!listRes.ok || ids.length === 0) continue;

        const detailRes = await fetch(
          `https://open.api.nexon.com/fconline/v1/match-detail?matchid=${encodeURIComponent(ids[0])}`,
          { headers, cache: "no-store" }
        );
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
          metadataStatus: metaRes.status,
          officialMatchTypes: officialRows,
          workingQuery: query,
          listStatus: listRes.status,
          listCount: ids.length,
          detailStatus: detailRes.status,
          detailHasMatchInfo:
            !!detailBody &&
            typeof detailBody === "object" &&
            !Array.isArray(detailBody) &&
            Array.isArray((detailBody as { matchInfo?: unknown }).matchInfo),
          detailBody: detailRes.ok ? undefined : detailBody,
          attempts,
        });
      }
    }

    return NextResponse.json({
      ok: false,
      step: "match-list",
      hasKey: true,
      metadataStatus: metaRes.status,
      officialMatchTypes: officialRows,
      attempts,
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
