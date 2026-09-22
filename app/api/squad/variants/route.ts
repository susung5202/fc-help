import { NextResponse } from "next/server";

type Player = { id: number; name: string };
type Season = { seasonId: number; className: string; seasonImg: string };

type Variant = {
  id: number;
  name: string;
  seasonName: string;
  seasonImg: string | null;
  salary: number | null;
  ovr: number | null;
  position: string | null;
  newTraits: string[];
};

const PLAYERS_URL = "https://open.api.nexon.com/static/fconline/meta/spid.json";
const SEASONS_URL = "https://open.api.nexon.com/static/fconline/meta/seasonid.json";
const MOBILE_PLAYER_URL = "https://m.fconline.nexon.com/datacenter/playerinfo";

const POSITIONS = [
  "GK", "SW", "RWB", "RB", "RCB", "CB", "LCB", "LB", "LWB",
  "RDM", "CDM", "LDM", "RM", "RCM", "CM", "LCM", "LM",
  "RAM", "CAM", "LAM", "RF", "CF", "LF", "RW", "RS", "ST", "LS",
] as const;

const NEW_TRAITS = [
  "라인 브레이커", "크로스 포쳐", "와일드 태클러", "체이서",
  "아크로바틱 피니셔", "2개의 심장", "파이터", "GK 빠른 반응",
  "스피드스터", "타이탄", "커맨더", "블로커", "GK 공중볼 장악",
  "트릭스터", "레이저 슈터", "프레데터", "GK 데드아이",
] as const;

export const maxDuration = 60;

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)));
}

function htmlToText(html: string) {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function compact(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
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

  const fallback = htmlToText(html).match(new RegExp(`${escapeRegExp(playerName)}\\s+(\\d{1,2})(?=\\s|$)`));
  if (!fallback) return null;
  const salary = Number(fallback[1]);
  return Number.isFinite(salary) && salary >= 0 && salary <= 99 ? salary : null;
}

function parseOvrPositionTraits(html: string) {
  const text = htmlToText(html);
  const positionPattern = POSITIONS.join("|");
  const pattern = new RegExp(`(?:^|\\s)(\\d{2,3})\\s+(${positionPattern})(?=\\s|$)`, "g");
  let ovr: number | null = null;
  let position: string | null = null;

  for (const match of text.matchAll(pattern)) {
    const value = Number(match[1]);
    if (Number.isFinite(value) && value >= 40 && value <= 200) {
      ovr = value;
      position = match[2];
      break;
    }
  }

  const compactText = compact(text);
  const newTraits = NEW_TRAITS.filter((trait) => compactText.includes(compact(trait)));
  return { ovr, position, newTraits: [...newTraits] };
}

async function fetchMeta<T>(url: string): Promise<T> {
  const response = await fetch(url, { next: { revalidate: 86400 } });
  if (!response.ok) throw new Error(`metadata request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

async function fetchVariant(player: Player, seasonMap: Map<number, Season>): Promise<Variant> {
  const response = await fetch(`${MOBILE_PLAYER_URL}?spid=${player.id}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
    next: { revalidate: 3600 },
  });

  const season = seasonMap.get(Math.floor(player.id / 1_000_000));
  if (!response.ok) {
    return {
      id: player.id,
      name: player.name,
      seasonName: season?.className ?? "시즌 미확인",
      seasonImg: season?.seasonImg ?? null,
      salary: null,
      ovr: null,
      position: null,
      newTraits: [],
    };
  }

  const html = await response.text();
  const parsed = parseOvrPositionTraits(html);
  return {
    id: player.id,
    name: player.name,
    seasonName: season?.className ?? "시즌 미확인",
    seasonImg: season?.seasonImg ?? null,
    salary: parseSalary(html, player.name),
    ...parsed,
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const spid = Number(searchParams.get("spid"));
  if (!Number.isInteger(spid) || spid <= 0) {
    return NextResponse.json({ error: "선수 정보가 올바르지 않습니다." }, { status: 400 });
  }

  try {
    const [players, seasons] = await Promise.all([
      fetchMeta<Player[]>(PLAYERS_URL),
      fetchMeta<Season[]>(SEASONS_URL),
    ]);

    const current = players.find((player) => player.id === spid);
    if (!current) return NextResponse.json({ variants: [] });

    const seasonMap = new Map(seasons.map((season) => [Number(season.seasonId), season]));
    const sameName = players
      .filter((player) => player.name === current.name)
      .sort((a, b) => b.id - a.id);

    // Do not truncate historical seasons. The old 18-card cap hid classes such as EBS
    // for players with many released versions.
    const selected = [
      current,
      ...sameName.filter((player) => player.id !== current.id),
    ];

    const variants = await Promise.all(selected.map((player) => fetchVariant(player, seasonMap)));
    return NextResponse.json({ variants }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    console.error("Squad variants failed", { spid, error });
    return NextResponse.json({ variants: [] });
  }
}
