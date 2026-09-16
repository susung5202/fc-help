import { NextResponse } from "next/server";

type PositionMeta = {
  spposition: number;
  desc: string;
};

type CardData = {
  salary: number | null;
  prices: Array<string | null>;
  positionOvr: number | null;
};

const MOBILE_PLAYER_URL = "https://m.fconline.nexon.com/datacenter/playerinfo";
const PLAYER_LIST_URL = "https://fconline.nexon.com/datacenter/PlayerList";
const POSITION_META_URL = "https://open.api.nexon.com/static/fconline/meta/spposition.json";
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

async function getPositionCode(position: string): Promise<number | null> {
  try {
    const response = await fetch(POSITION_META_URL, { next: { revalidate: 86400 } });
    if (!response.ok) return null;
    const items = (await response.json()) as PositionMeta[];
    return items.find((item) => item.desc === position)?.spposition ?? null;
  } catch {
    return null;
  }
}

function extractPlayerRow(html: string, spid: number) {
  const markerPattern = new RegExp(`\\.val\\(['\"]${spid}['\"]\\)`);
  const marker = markerPattern.exec(html);
  if (!marker) return null;

  const start = html.lastIndexOf('<div class="tr', marker.index);
  const next = html.indexOf('<div class="tr', marker.index + marker[0].length);
  const safeStart = start >= 0 ? start : Math.max(0, marker.index - 5000);
  const safeEnd = next >= 0 ? next : Math.min(html.length, marker.index + 20000);
  return html.slice(safeStart, safeEnd);
}

function parsePlayerListPositionOvr(row: string, spid: number, position: string) {
  const escapedPosition = escapeRegExp(position);
  const directPattern = new RegExp(
    `<span[^>]*class=["'][^"']*position[^"']*["'][^>]*>[\\s\\S]{0,1200}?` +
      `<span[^>]*class=["'][^"']*txt[^"']*["'][^>]*>\\s*${escapedPosition}\\s*<\\/span>` +
      `[\\s\\S]{0,1200}?<span[^>]*class=["'][^"']*skillData_${spid}[^"']*["'][^>]*>\\s*(\\d{2,3})`,
    "i"
  );
  const direct = row.match(directPattern);
  if (direct) return Number(direct[1]);

  const skillPattern = new RegExp(
    `<span[^>]*class=["'][^"']*skillData_${spid}[^"']*["'][^>]*>\\s*(\\d{2,3})\\s*<\\/span>`,
    "gi"
  );

  for (const match of row.matchAll(skillPattern)) {
    const index = match.index ?? 0;
    const before = htmlToText(row.slice(Math.max(0, index - 700), index));
    if (new RegExp(`(?:^|\\s)${escapedPosition}(?=\\s|$)`).test(before)) {
      return Number(match[1]);
    }
  }

  return null;
}

async function fetchPositionOvr(spid: number, playerName: string, position: string) {
  const positionCode = await getPositionCode(position);
  if (positionCode === null) return null;

  try {
    const body = new URLSearchParams({
      strPlayerName: playerName,
      strSeason: "",
      strPosition: `,${positionCode},`,
      n4SalaryMin: "0",
      n4SalaryMax: "99",
      n4OvrMin: "0",
      n4OvrMax: "200",
    });

    const response = await fetch(PLAYER_LIST_URL, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://fconline.nexon.com/datacenter/",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body,
      cache: "no-store",
    });

    if (!response.ok) return null;
    const html = await response.text();
    const row = extractPlayerRow(html, spid);
    return row ? parsePlayerListPositionOvr(row, spid, position) : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const spid = Number(searchParams.get("spid"));
  const playerName = (searchParams.get("name") ?? "").trim();
  const position = (searchParams.get("position") ?? "").trim().toUpperCase();

  if (!Number.isInteger(spid) || spid <= 0 || !playerName || !position) {
    return NextResponse.json({ error: "선수 또는 포지션 정보가 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const [mobileHtml, listOvr] = await Promise.all([
      fetchMobilePlayerHtml(spid),
      fetchPositionOvr(spid, playerName, position),
    ]);

    const data: CardData = {
      salary: parseSalary(mobileHtml, playerName),
      prices: parsePrices(mobileHtml),
      positionOvr: listOvr ?? parseMobilePositionOvr(mobileHtml, position),
    };

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    });
  } catch (error) {
    console.error("Squad card data failed", { spid, playerName, position, error });
    return NextResponse.json(
      { salary: null, prices: Array.from({ length: 13 }, () => null), positionOvr: null },
      { status: 200 }
    );
  }
}
