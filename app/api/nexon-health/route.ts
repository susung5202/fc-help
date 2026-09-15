import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.NEXON_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ ok: false, hasKey: false, reason: "missing_env" });
  }

  const url = "https://open.api.nexon.com/fconline/v1/match?matchtype=50&offset=0&limit=5&orderby=desc";

  try {
    const res = await fetch(url, {
      headers: { "x-nxopen-api-key": apiKey },
      cache: "no-store",
    });
    const text = await res.text();

    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = text.slice(0, 300);
    }

    return NextResponse.json({
      ok: res.ok,
      hasKey: true,
      status: res.status,
      isArray: Array.isArray(body),
      count: Array.isArray(body) ? body.length : null,
      sample: Array.isArray(body) ? body.slice(0, 2) : body,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      hasKey: true,
      reason: "fetch_failed",
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}
