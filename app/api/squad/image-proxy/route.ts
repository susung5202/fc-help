import { NextResponse } from "next/server";

const ALLOWED_HOST_SUFFIXES = [".nexon.com", ".nexoncdn.co.kr"];
const ALLOWED_EXACT_HOSTS = new Set(["nexon.com", "ssl.nexon.com"]);

function isAllowedHost(hostname: string) {
  const normalized = hostname.toLowerCase();
  if (ALLOWED_EXACT_HOSTS.has(normalized)) return true;
  return ALLOWED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "url required" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  if (target.protocol !== "https:" || !isAllowedHost(target.hostname)) {
    return NextResponse.json({ error: "unsupported image host" }, { status: 400 });
  }

  try {
    const response = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      },
      next: { revalidate: 86400 },
    });
    if (!response.ok || !response.body) {
      return NextResponse.json({ error: "image fetch failed" }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") ?? "image/png";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "not an image" }, { status: 415 });
    }

    return new NextResponse(response.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return NextResponse.json({ error: "image proxy failed" }, { status: 502 });
  }
}
