import { NextResponse } from "next/server";

export function GET() {
  return new NextResponse(
    "google.com, pub-6735658400194219, DIRECT, f08c47fec0942fa0\n",
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}
