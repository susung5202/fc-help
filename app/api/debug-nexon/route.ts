import { NextResponse } from "next/server";

const API_BASE = "https://open.api.nexon.com/fconline/v1";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.NEXON_API_KEY;
  const result: Record<string, unknown> = { hasKey: Boolean(apiKey) };

  if (!apiKey) {
    return NextResponse.json(result, { status: 200 });
  }

  try {
    const matchRes = await fetch(
      `${API_BASE}/match?matchtype=50&offset=0&limit=2&orderby=desc`,
      {
        headers: { "x-nxopen-api-key": apiKey },
        cache: "no-store",
      }
    );

    result.matchStatus = matchRes.status;
    const matchText = await matchRes.text();

    let matchData: unknown = null;
    try {
      matchData = JSON.parse(matchText);
    } catch {
      result.matchBodyPreview = matchText.slice(0, 200);
    }

    result.matchIsArray = Array.isArray(matchData);
    result.matchCount = Array.isArray(matchData) ? matchData.length : null;

    if (!matchRes.ok) {
      result.matchError = matchData;
      return NextResponse.json(result);
    }

    const first = Array.isArray(matchData) ? matchData[0] : null;
    const matchId =
      typeof first === "string"
        ? first
        : first && typeof first === "object" && "matchId" in first
          ? String((first as { matchId?: unknown }).matchId ?? "")
          : "";

    result.firstMatchShape =
      typeof first === "string"
        ? "string"
        : first && typeof first === "object"
          ? Object.keys(first as Record<string, unknown>)
          : typeof first;

    if (!matchId) return NextResponse.json(result);

    const detailRes = await fetch(
      `${API_BASE}/match-detail?matchid=${encodeURIComponent(matchId)}`,
      {
        headers: { "x-nxopen-api-key": apiKey },
        cache: "no-store",
      }
    );

    result.detailStatus = detailRes.status;
    const detailText = await detailRes.text();
    let detailData: unknown = null;
    try {
      detailData = JSON.parse(detailText);
    } catch {
      result.detailBodyPreview = detailText.slice(0, 200);
    }

    if (!detailRes.ok) {
      result.detailError = detailData;
      return NextResponse.json(result);
    }

    const detail = detailData as {
      matchInfo?: Array<{ player?: Array<Record<string, unknown>> }>;
    };
    result.matchInfoCount = detail.matchInfo?.length ?? 0;
    result.playerCount = detail.matchInfo?.reduce(
      (sum, info) => sum + (info.player?.length ?? 0),
      0
    ) ?? 0;
    const sample = detail.matchInfo?.[0]?.player?.[0];
    result.samplePlayerKeys = sample ? Object.keys(sample) : [];
    result.sampleStatusKeys =
      sample && sample.status && typeof sample.status === "object"
        ? Object.keys(sample.status as Record<string, unknown>)
        : [];

    return NextResponse.json(result);
  } catch (error) {
    result.exception = error instanceof Error ? error.message : String(error);
    return NextResponse.json(result);
  }
}
