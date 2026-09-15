export type PlayerRankingItem = {
  spid: number;
  name: string;
  grade: number;
  metric: number;
  price: string | null;
};

export type PlayerRankings = {
  popular: PlayerRankingItem[];
  rating: PlayerRankingItem[];
  grade: PlayerRankingItem[];
};

type RankingKind = "popular" | "rating";

const PLAYER_STATS_URL =
  "https://fconline.nexon.com/datacenter/PlayerRankerStatList";
const DAILY_TRADE_URL = "https://fconline.nexon.com/datacenter/dailytrade";
const OFFICIAL_REFERER = "https://fconline.nexon.com/DataCenter/PlayerStat";
const CACHE_SECONDS = 3600;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

function decodeHtml(value: string) {
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

function htmlToText(value: string) {
  return decodeHtml(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value: string) {
  const match = htmlToText(value).match(/[\d,.]+/);
  if (!match) return null;

  const parsed = Number(match[0].replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function playerStatParams(orderBy: string) {
  return new URLSearchParams({
    n1Confederation: "0",
    n4LeagueId: "0",
    strSeason: "",
    strPosition: "",
    n4TeamId: "0",
    n4NationId: "0",
    n1Strong: "1",
    n1Grow: "0",
    n1TeamColor: "0",
    strOrderby: orderBy,
    strOrderbyDetail: "",
    n1History: "0",
    n4PlayYear: "0",
    teamcolorid: "0",
    strTeamColorCategory: "",
    strPlayerName: "",
    strTeamName: "",
    strNationName: "",
    strTeamColorName: "",
    n4RankerMin: "1",
    n4RankerMax: "10000",
    n1PlayType: "50",
    n4OvrMin: "",
    n4OvrMax: "",
    n4SalaryMin: "",
    n4SalaryMax: "",
    n4PageNo: "1",
  });
}

async function fetchPlayerStatRanking(kind: RankingKind) {
  const orderBy =
    kind === "popular"
      ? "count_matchid descending"
      : "total_rating descending";
  const response = await fetch(PLAYER_STATS_URL, {
    method: "POST",
    headers: {
      Accept: "text/html, */*; q=0.01",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": USER_AGENT,
      "X-Requested-With": "XMLHttpRequest",
      Referer: OFFICIAL_REFERER,
      Origin: "https://fconline.nexon.com",
    },
    body: playerStatParams(orderBy),
    next: { revalidate: CACHE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`FC Online player stats HTTP ${response.status}`);
  }

  return parsePlayerStatRanking(await response.text(), kind);
}

export function parsePlayerStatRanking(
  html: string,
  kind: RankingKind
): PlayerRankingItem[] {
  const rowPattern =
    /<div\s+class="tr"[^>]*onclick="[^"]*PlayerVs1[^"]*?val\([^\d]*(\d+)[^"]*"[^>]*>/gi;
  const rows = [...html.matchAll(rowPattern)];
  const metricClass = kind === "popular" ? "p_at" : "p_av";
  const results: PlayerRankingItem[] = [];
  const seen = new Set<number>();

  for (let index = 0; index < rows.length && results.length < 5; index += 1) {
    const spid = Number(rows[index][1]);
    if (!Number.isFinite(spid) || seen.has(spid)) continue;

    const start = rows[index].index ?? 0;
    const end = rows[index + 1]?.index ?? html.length;
    const block = html.slice(start, end);
    const nameMatch = block.match(
      /<div\s+class=["']info_top["'][^>]*>[\s\S]*?<div\s+class=["']name["'][^>]*>([\s\S]*?)<\/div>/i
    );
    const gradeMatch = block.match(
      new RegExp(`name=["']Strong${spid}["'][^>]*value=["'](\\d+)\\/`, "i")
    );
    const metricMatch = block.match(
      new RegExp(
        `<div\\s+class=["']td\\s+${metricClass}["'][^>]*>([\\s\\S]*?)<\\/div>`,
        "i"
      )
    );
    const name = nameMatch ? htmlToText(nameMatch[1]) : "";
    const metric = metricMatch ? parseNumber(metricMatch[1]) : null;

    if (!name || metric === null) continue;

    seen.add(spid);
    results.push({
      spid,
      name,
      grade: Number(gradeMatch?.[1] ?? 1),
      metric,
      price: null,
    });
  }

  if (results.length < 5) {
    throw new Error(
      `FC Online ${kind} ranking parse failed (${results.length}/5)`
    );
  }

  return results;
}

async function fetchReinforcementRanking() {
  const response = await fetch(DAILY_TRADE_URL, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
      "User-Agent": USER_AGENT,
    },
    next: { revalidate: CACHE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`FC Online daily trade HTTP ${response.status}`);
  }

  return parseReinforcementRanking(await response.text());
}

export function parseReinforcementRanking(html: string): PlayerRankingItem[] {
  const sectionStart = html.search(/id=["']goldTrade["']/i);
  const sectionEnd = html.search(/id=["']rankWin["']/i);

  if (sectionStart < 0 || sectionEnd <= sectionStart) {
    throw new Error("FC Online reinforcement ranking section not found");
  }

  const section = html.slice(sectionStart, sectionEnd);
  const playerPattern =
    /PlayerInfo\?spid=(\d+)&(?:amp;)?n1Strong=(\d+)[^>]*>[\s\S]*?<span\s+class=["']hidden["'][^>]*>([\s\S]*?)<\/span>/gi;
  const matches = [...section.matchAll(playerPattern)];
  const results: PlayerRankingItem[] = [];
  const seen = new Set<string>();

  for (
    let index = 0;
    index < matches.length && results.length < 5;
    index += 1
  ) {
    const spid = Number(matches[index][1]);
    const grade = Number(matches[index][2]);
    const key = `${spid}:${grade}`;
    if (!Number.isFinite(spid) || !Number.isFinite(grade) || seen.has(key)) {
      continue;
    }

    const start = matches[index].index ?? 0;
    const end = matches[index + 1]?.index ?? section.length;
    const block = section.slice(start, end);
    const priceMatch = block.match(
      /<span\s+class=["']price["'][^>]*(?:alt|title)=["']([\d,]+)["'][^>]*>([\s\S]*?)<\/span>/i
    );
    const priceValue = priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : 0;
    const price = priceMatch ? htmlToText(priceMatch[2]) : null;
    const name = htmlToText(matches[index][3]);

    if (!name || !price || !Number.isFinite(priceValue) || priceValue <= 0) {
      continue;
    }

    seen.add(key);
    results.push({ spid, name, grade, metric: priceValue, price });
  }

  if (results.length < 5) {
    throw new Error(
      `FC Online reinforcement ranking parse failed (${results.length}/5)`
    );
  }

  return results;
}

async function safelyLoad(
  label: string,
  loader: () => Promise<PlayerRankingItem[]>
) {
  try {
    return await loader();
  } catch (error) {
    console.error(`Failed to load ${label} from FC Online Data Center`, error);
    return [];
  }
}

export async function getPlayerRankings(): Promise<PlayerRankings> {
  const [popular, rating, grade] = await Promise.all([
    safelyLoad("popular players", () => fetchPlayerStatRanking("popular")),
    safelyLoad("player ratings", () => fetchPlayerStatRanking("rating")),
    safelyLoad("reinforcement trades", fetchReinforcementRanking),
  ]);

  return { popular, rating, grade };
}
