import { NextResponse } from "next/server";
import {
  calculatePositionOvrFromText,
  normalizeSquadPosition,
} from "@/lib/fconline/positionOvr";

type CardData = {
  salary: number | null;
  prices: Array<string | null>;
  positionOvr: number | null;
  traitIcons: Record<string, string>;
};

const MOBILE_PLAYER_URL = "https://m.fconline.nexon.com/datacenter/playerinfo";
const ALL_POSITIONS = [
  "GK",
  "SW",
  "RWB",
  "RB",
  "RCB",
  "CB",
  "LCB",
  "LB",
  "LWB",
  "RDM",
  "CDM",
  "LDM",
  "RM",
  "RCM",
  "CM",
  "LCM",
  "LM",
  "RAM",
  "CAM",
  "LAM",
  "RF",
  "CF",
  "LF",
  "RW",
  "RS",
  "ST",
  "LS",
] as const;

export const maxDuration = 30;

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10))
    );
}

function htmlToText(html: string) {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseSalary(html: string, playerName: string): number | null {
  const patterns = [
    /<div[^>]*class=["'][^"']*\bpay\b[^"']*["'][^>]*>[\s\S]{0,300}?<span[^>]*>\s*(\d{1,2})\s*<\/span>/i,
    /<div[^>]*class=["'][^"']*\bpay_side\b[^"']*["'][^>]*>\s*(\d{1,2})\s*<\/div>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match) continue;
    const salary = Number(match[1]);
    if (Number.isFinite(salary) && salary >= 0 && salary <= 99) return salary;
  }

  const text = htmlToText(html);
  const fallback = text.match(
    new RegExp(`${escapeRegExp(playerName)}\\s+(\\d{1,2})(?=\\s|$)`)
  );
  if (!fallback) return null;

  const salary = Number(fallback[1]);
  return Number.isFinite(salary) && salary >= 0 && salary <= 99 ? salary : null;
}

function parsePrices(html: string): Array<string | null> {
  const text = htmlToText(html);
  const abilityIndex = text.indexOf("능력치");
  const header = abilityIndex >= 0 ? text.slice(0, abilityIndex) : text;
  const prices = Array.from(header.matchAll(/(\d[\d,]*)\s*BP/g))
    .map((match) => match[1].replace(/,/g, ""))
    .filter((value) => /^\d+$/.test(value));

  const selected = prices.slice(0, 13);
  return Array.from({ length: 13 }, (_, index) => selected[index] ?? null);
}

function parseMobilePositionOvr(html: string, position: string): number | null {
  if (!ALL_POSITIONS.includes(position as (typeof ALL_POSITIONS)[number])) return null;

  const text = htmlToText(html);
  const escaped = escapeRegExp(position);
  const positionFirst = text.match(
    new RegExp(`(?:^|\\s)${escaped}\\s+(\\d{2,3})(?=\\s|$)`)
  );
  if (positionFirst) return Number(positionFirst[1]);

  const valueFirst = text.match(
    new RegExp(`(?:^|\\s)(\\d{2,3})\\s+${escaped}(?=\\s|$)`)
  );
  if (valueFirst) return Number(valueFirst[1]);

  return null;
}

function normalizeAssetUrl(src: string) {
  if (src.startsWith("//")) return `https:${src}`;
  if (src.startsWith("/")) return `https://m.fconline.nexon.com${src}`;
  return src;
}

function getTagAttribute(tag: string, attribute: string) {
  const match = tag.match(
    new RegExp(`${attribute}\\s*=\\s*["']([^"']+)["']`, "i")
  );
  return match ? decodeHtmlEntities(match[1]).trim() : null;
}

function parseTraitIcons(html: string): Record<string, string> {
  const result: Record<string, string> = {};
  const tags = html.match(/<img\b[^>]*>/gi) ?? [];

  for (const tag of tags) {
    const src = getTagAttribute(tag, "src");
    if (!src || !/\/traits\/trait_icon_/i.test(src)) continue;

    const alt = getTagAttribute(tag, "alt") ?? getTagAttribute(tag, "title");
    if (!alt) continue;
    result[alt] = normalizeAssetUrl(src);
  }

  return result;
}

async function fetchMobilePlayerHtml(spid: number) {
  const response = await fetch(`${MOBILE_PLAYER_URL}?spid=${spid}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
    next: { revalidate: 300 },
  });

  if (!response.ok) throw new Error(`mobile player request failed: ${response.status}`);
  return response.text();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const spid = Number(searchParams.get("spid"));
  const playerName = (searchParams.get("name") ?? "").trim();
  const position = (searchParams.get("position") ?? "").trim().toUpperCase();

  if (!Number.isInteger(spid) || spid <= 0 || !playerName || !position) {
    return NextResponse.json(
      { error: "선수 또는 포지션 정보가 올바르지 않습니다." },
      { status: 400 }
    );
  }

  try {
    const mobileHtml = await fetchMobilePlayerHtml(spid);
    const text = htmlToText(mobileHtml);
    const normalizedPosition = normalizeSquadPosition(position);

    const data: CardData = {
      salary: parseSalary(mobileHtml, playerName),
      prices: parsePrices(mobileHtml),
      positionOvr:
        parseMobilePositionOvr(mobileHtml, normalizedPosition) ??
        calculatePositionOvrFromText(text, normalizedPosition),
      traitIcons: parseTraitIcons(mobileHtml),
    };

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    });
  } catch (error) {
    console.error("Squad card data failed", { spid, playerName, position, error });
    return NextResponse.json(
      {
        salary: null,
        prices: Array.from({ length: 13 }, () => null),
        positionOvr: null,
        traitIcons: {},
      },
      { status: 200 }
    );
  }
}
