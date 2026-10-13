import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      serverNow: new Date().toISOString(),
      timeZone: "Asia/Seoul",
      source: "FC Help server",
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
