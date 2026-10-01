import { NextResponse } from "next/server";

type TeamColorCategory = "affiliation" | "feature";

type TeamColorCatalogItem = {
  id: number;
  name: string;
  category: TeamColorCategory;
};

type TeamColorSearchItem = TeamColorCatalogItem & {
  related: boolean;
  overlap?: number;
};

type TeamColorPlayer = {
  name: string;
  sampleSpid: number;
  position: string | null;
};

type PlayerMeta = {
  id: number;
  name: string;
};

type SeasonMeta = {
  seasonId: number;
  className: string;
  seasonImg: string;
};

type TeamColorSeasonCard = {
  id: number;
  name: string;
  seasonName: string;
  seasonImg: string | null;
  ovr: number | null;
  position: string | null;
  newTraits: string[];
};

type RelationshipOption = {
  id: number | null;
  name: string;
};

const DATA_CENTER_URL = "https://fconline.nexon.com/DataCenter";
const PLAYER_LIST_URL = "https://fconline.nexon.com/datacenter/PlayerList";
const PLAYER_ABILITY_URL = "https://fconline.nexon.com/datacenter/PlayerAbility";
const PLAYER_META_URL = "https://open.api.nexon.com/static/fconline/meta/spid.json";
const SEASON_META_URL = "https://open.api.nexon.com/static/fconline/meta/seasonid.json";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const CATALOG_CACHE_MS = 6 * 60 * 60 * 1000;
const SEARCH_CACHE_MS = 6 * 60 * 60 * 1000;
const PLAYER_CACHE_MS = 60 * 60 * 1000;
const RELATIONSHIP_CACHE_MS = 6 * 60 * 60 * 1000;

let catalogCache: { expiresAt: number; items: TeamColorCatalogItem[] } | null = null;
let nationNameKeys = new Set<string>();
let playerMetaPromise: Promise<PlayerMeta[]> | null = null;
let seasonMetaPromise: Promise<SeasonMeta[]> | null = null;
let metadataExpiresAt = 0;
const queryCache = new Map<string, { expiresAt: number; items: TeamColorSearchItem[] }>();
const playerCache = new Map<number, { expiresAt: number; items: TeamColorPlayer[] }>();
const seasonCardCache = new Map<string, { expiresAt: number; items: TeamColorSeasonCard[] }>();
const relationshipCache = new Map<number, { expiresAt: number; items: RelationshipOption[] }>();

export const maxDuration = 60;

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
  return decodeHtmlEntities(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[\s._\-–—·'’"()\[\]]+/g, "");
}

function getClassAttribute(tag: string) {
  return tag.match(/\bclass\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
}

function hasClass(tag: string, className: string) {
  return getClassAttribute(tag)
    .split(/\s+/)
    .some((value) => value === className);
}

function findMatchingDivEnd(html: string, startIndex: number) {
  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = startIndex;
  let depth = 0;

  for (let match = tagPattern.exec(html); match; match = tagPattern.exec(html)) {
    if (/^<\/div/i.test(match[0])) {
      depth -= 1;
      if (depth === 0) return tagPattern.lastIndex;
    } else {
      depth += 1;
    }
  }

  return html.length;
}

function extractDivBlocksByClass(html: string, className: string) {
  const blocks: string[] = [];
  const openPattern = /<div\b[^>]*>/gi;

  for (let match = openPattern.exec(html); match; match = openPattern.exec(html)) {
    if (!hasClass(match[0], className)) continue;
    const end = findMatchingDivEnd(html, match.index);
    blocks.push(html.slice(match.index, end));
    openPattern.lastIndex = end;
  }

  return blocks;
}

function parseId(markup: string) {
  const match =
    markup.match(/\bdata-no\s*=\s*["'](\d+)["']/i) ??
    markup.match(/(?:teamcolorid|n4TeamColorId)[^\d]{0,20}(\d+)/i);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseCatalog(html: string) {
  const result = new Map<number, TeamColorCatalogItem>();
  const nationalities = new Set<string>();
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorPattern)) {
    const attributes = match[1];
    const className = attributes.match(/\bclass\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
    const name = htmlToText(match[2]);
    if (className.includes("nationality_item")) {
      const key = normalize(name);
      if (key) nationalities.add(key);
      continue;
    }
    const category: TeamColorCategory | null = className.includes("tcboosts_affiliation")
      ? "affiliation"
      : className.includes("tcboosts_feature")
        ? "feature"
        : null;
    if (!category) continue;
    const id = parseId(attributes);
    if (!id || !name || name.length > 80) continue;
    result.set(id, { id, name, category });
  }
  nationNameKeys = nationalities;
  return Array.from(result.values());
}

async function getCatalog() {
  if (catalogCache && catalogCache.expiresAt > Date.now()) return catalogCache.items;

  const response = await fetch(DATA_CENTER_URL, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`teamcolor catalog request failed: ${response.status}`);

  const items = parseCatalog(await response.text());
  catalogCache = { expiresAt: Date.now() + CATALOG_CACHE_MS, items };
  return items;
}

async function getPlayerMeta(): Promise<PlayerMeta[]> {
  if (playerMetaPromise && Date.now() < metadataExpiresAt) return playerMetaPromise;
  playerMetaPromise = fetch(PLAYER_META_URL, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("player metadata request failed");
      return response.json() as Promise<PlayerMeta[]>;
    })
    .catch((error) => {
      playerMetaPromise = null;
      throw error;
    });
  metadataExpiresAt = Date.now() + CATALOG_CACHE_MS;
  return playerMetaPromise;
}

async function getSeasonMeta(): Promise<SeasonMeta[]> {
  if (seasonMetaPromise && Date.now() < metadataExpiresAt) return seasonMetaPromise;
  seasonMetaPromise = fetch(SEASON_META_URL, { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("season metadata request failed");
      return response.json() as Promise<SeasonMeta[]>;
    })
    .catch((error) => {
      seasonMetaPromise = null;
      throw error;
    });
  metadataExpiresAt = Date.now() + CATALOG_CACHE_MS;
  return seasonMetaPromise;
}

function buildPlayerListBody(teamColor: TeamColorCatalogItem, page: number) {
  return new URLSearchParams({
    n8PlayerGrade1Min: "",
    n8PlayerGrade1Max: "",
    n1Confederation: "0",
    n4LeagueId: "0",
    strSeason: "",
    strPosition: "",
    strPhysical: "",
    preferredfoot: "0",
    n1FootAblity: "0",
    n1SkillMove: "0",
    n1InterationalRep: "0",
    n4BirthMonth: "0",
    n4BirthDay: "0",
    n4TeamId: "0",
    n4NationId: "0",
    strAbility1: "",
    strAbility2: "",
    strAbility3: "",
    strTrait1: "",
    strTrait2: "",
    strTrait3: "",
    strTraitNon1: "",
    strTraitNon2: "",
    strTraitNon3: "",
    n1Strong: "1",
    n1Grow: "0",
    n1TeamColor: "0",
    strSkill1: "sprintspeed",
    strSkill2: "acceleration",
    strSkill3: "strength",
    strSkill4: "stamina",
    strSearchStatus: "off",
    strOrderby: "",
    teamcolorid: String(teamColor.id),
    strTeamColorCategory: "",
    n1History: "0",
    n4PlayYear: "0",
    IsSummaryPlayer: "1",
    strPlayerName: "",
    strTeamName: "",
    strNationName: "",
    strTeamColorName: teamColor.name,
    n4OvrMin: "",
    n4OvrMax: "",
    n4SalaryMin: "",
    n4SalaryMax: "",
    n1Ability1Min: "",
    n1Ability1Max: "",
    n1Ability2Min: "",
    n1Ability2Max: "",
    n1Ability3Min: "",
    n1Ability3Max: "",
    n4BirthYearMin: "",
    n4BirthYearMax: "",
    n4HeightMin: "",
    n4HeightMax: "",
    n4WeightMin: "",
    n4WeightMax: "",
    n4AvgPointMin: "",
    n4AvgPointMax: "",
    n4PageNo: String(page),
  });
}

function parsePlayerRows(html: string): TeamColorPlayer[] {
  const rows: TeamColorPlayer[] = [];
  const pattern = /<div\s+id=["']area_playerunit_(\d+)["'][^>]*>([\s\S]*?)(?=<div\s+id=["']area_playerunit_|<script\b|$)/gi;

  for (const match of html.matchAll(pattern)) {
    const sampleSpid = Number(match[1]);
    if (!Number.isInteger(sampleSpid) || sampleSpid <= 0) continue;
    const row = match[2];
    const nameMarkup = row.match(/<div\s+class=["']name["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? "";
    const name = htmlToText(nameMarkup);
    if (!name) continue;
    const positionMarkup = row.match(
      /<span\s+class=["'][^"']*position[^"']*["'][^>]*>[\s\S]*?<span\s+class=["']txt["'][^>]*>([^<]+)<\/span>/i
    )?.[1];
    const position = positionMarkup ? htmlToText(positionMarkup).toUpperCase() : null;
    rows.push({ name, sampleSpid, position });
  }

  return rows;
}

async function fetchPlayerListPage(teamColor: TeamColorCatalogItem, page: number) {
  const response = await fetch(PLAYER_LIST_URL, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html, */*; q=0.01",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Referer: DATA_CENTER_URL,
      Origin: "https://fconline.nexon.com",
    },
    body: buildPlayerListBody(teamColor, page),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`teamcolor player request failed: ${response.status}`);
  return parsePlayerRows(await response.text());
}

async function getPlayersForTeamColor(teamColor: TeamColorCatalogItem, pageLimit = 8, maxPlayers = 240) {
  const cached = playerCache.get(teamColor.id);
  if (cached && cached.expiresAt > Date.now()) return cached.items;

  const byName = new Map<string, TeamColorPlayer>();
  let previousSignature = "";

  for (let page = 1; page <= pageLimit && byName.size < maxPlayers; page += 1) {
    const rows = await fetchPlayerListPage(teamColor, page);
    if (rows.length === 0) break;
    const signature = rows.map((row) => `${row.sampleSpid}:${row.name}`).join("|");
    if (signature === previousSignature) break;
    previousSignature = signature;

    let newCount = 0;
    for (const player of rows) {
      const key = normalize(player.name);
      if (!key || byName.has(key)) continue;
      byName.set(key, player);
      newCount += 1;
      if (byName.size >= maxPlayers) break;
    }
    if (newCount === 0) break;
  }

  const items = Array.from(byName.values());
  playerCache.set(teamColor.id, { expiresAt: Date.now() + PLAYER_CACHE_MS, items });
  return items;
}

async function getAllSeasonCardsForTeamColor(
  teamColor: TeamColorCatalogItem,
  target: "field" | "gk"
) {
  const cacheKey = `${teamColor.id}:${target}`;
  const cached = seasonCardCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.items;

  const [eligiblePlayers, playerMeta, seasons] = await Promise.all([
    getPlayersForTeamColor(teamColor, 2, 240),
    getPlayerMeta(),
    getSeasonMeta(),
  ]);
  const identityMap = new Map<number, TeamColorPlayer>();
  for (const player of eligiblePlayers) {
    const identity = player.sampleSpid % 1_000_000;
    if (!identityMap.has(identity)) identityMap.set(identity, player);
  }
  const seasonMap = new Map(seasons.map((season) => [Number(season.seasonId), season]));
  const items: TeamColorSeasonCard[] = [];
  for (const player of playerMeta) {
    const eligible = identityMap.get(player.id % 1_000_000);
    if (!eligible) continue;
    const isGoalkeeper = eligible.position === "GK";
    if ((target === "gk" && !isGoalkeeper) || (target === "field" && isGoalkeeper)) continue;
    const season = seasonMap.get(Math.floor(player.id / 1_000_000));
    items.push({
      id: player.id,
      name: player.name,
      seasonName: season?.className ?? "시즌 미확인",
      seasonImg: season?.seasonImg ?? null,
      ovr: null,
      position: eligible.position,
      newTraits: [],
    });
  }
  items.sort((a, b) => a.name.localeCompare(b.name, "ko-KR") || b.id - a.id);
  seasonCardCache.set(cacheKey, { expiresAt: Date.now() + PLAYER_CACHE_MS, items });
  return items;
}

function parseRelationshipOptions(html: string): RelationshipOption[] {
  const wrapper =
    extractDivBlocksByClass(html, "tspecial_wrap").find((block) =>
      htmlToText(block).includes("관계 팀컬러")
    ) ?? "";
  if (!wrapper) return [];

  const result = new Map<string, RelationshipOption>();
  for (const match of wrapper.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attributes = match[1];
    const tag = `<a ${attributes}>`;
    if (!hasClass(tag, "selector_item")) continue;
    const name = htmlToText(match[2]).replace(/^Lv\.\s*\d+\s*/i, "").trim();
    if (!name || ["관계 팀컬러", "특성 팀컬러", "단일팀"].includes(name)) continue;
    const id = parseId(attributes) ?? parseId(match[0]);
    const key = normalize(name);
    if (!key) continue;
    const previous = result.get(key);
    result.set(key, { id: previous?.id ?? id, name });
  }
  return Array.from(result.values());
}

async function getRelationshipOptions(spid: number) {
  const cached = relationshipCache.get(spid);
  if (cached && cached.expiresAt > Date.now()) return cached.items;

  const sourceUrl = `https://fconline.nexon.com/DataCenter/PlayerInfo?n1Strong=1&spid=${spid}`;
  const body = new URLSearchParams({
    spid: String(spid),
    n1Strong: "1",
    n1Grow: "4",
    n4TeamColorId: "0",
    n4TeamColorLv: "0",
    n4TeamColorId_Enhance: "0",
    n4TeamColorLv_Enhance: "0",
    n4TeamColorId_Feature: "0",
    n1Change: "0",
    strPlayerImg: `https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/playersAction/p${spid}.png`,
    rd: "0",
  });

  try {
    const response = await fetch(PLAYER_ABILITY_URL, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html, */*; q=0.01",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Referer: sourceUrl,
        Origin: "https://fconline.nexon.com",
      },
      body,
      cache: "no-store",
    });
    if (!response.ok) return [];
    const items = parseRelationshipOptions(await response.text());
    relationshipCache.set(spid, { expiresAt: Date.now() + RELATIONSHIP_CACHE_MS, items });
    return items;
  } catch {
    return [];
  }
}

function evenlySample<T>(items: T[], max: number) {
  if (items.length <= max) return items;
  const result: T[] = [];
  const used = new Set<number>();
  for (let index = 0; index < max; index += 1) {
    const sourceIndex = Math.round((index * (items.length - 1)) / (max - 1));
    if (used.has(sourceIndex)) continue;
    used.add(sourceIndex);
    result.push(items[sourceIndex]);
  }
  return result;
}

function getRelationStem(name: string) {
  const cleaned = name
    .replace(/\b\d{2,4}\s*[-~–]\s*\d{2,4}\b/g, " ")
    .replace(/\b\d+기\b/g, " ")
    .replace(/\b(공격|수비|중원|뉴|유럽|역대|전설|듀오|트리오|황금세대)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalize(cleaned).length >= 4 ? cleaned : "";
}

function getPlayerNameSet(players: TeamColorPlayer[]) {
  return new Set(players.map((player) => normalize(player.name)).filter(Boolean));
}

async function getRelatedFit(
  teamColor: TeamColorCatalogItem,
  baseNames: Set<string>
) {
  const players = await getPlayersForTeamColor(teamColor, 4, 160);
  if (players.length === 0) return null;
  const matched = players.filter((player) => baseNames.has(normalize(player.name))).length;
  const ratio = matched / players.length;
  const requiredRatio = players.length <= 4 ? 0.5 : players.length <= 8 ? 0.6 : 0.72;
  if (matched < 2 || ratio < requiredRatio) return null;
  return { matched, ratio, playerCount: players.length };
}

async function discoverRelatedTeamColors(
  affiliation: TeamColorCatalogItem,
  catalog: TeamColorCatalogItem[]
): Promise<TeamColorSearchItem[]> {
  const basePlayers = await getPlayersForTeamColor(affiliation, 8, 240);
  const baseNames = getPlayerNameSet(basePlayers);
  const samples = evenlySample(basePlayers, 64);
  const counts = new Map<string, { count: number; ids: Set<number> }>();

  for (let index = 0; index < samples.length; index += 8) {
    const batch = await Promise.all(
      samples.slice(index, index + 8).map((player) => getRelationshipOptions(player.sampleSpid))
    );
    for (const options of batch) {
      const seen = new Set<string>();
      for (const option of options) {
        const key = normalize(option.name);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const current = counts.get(key) ?? { count: 0, ids: new Set<number>() };
        current.count += 1;
        if (option.id) current.ids.add(option.id);
        counts.set(key, current);
      }
    }
  }

  const catalogByName = new Map(catalog.map((item) => [normalize(item.name), item]));
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const discovered: Array<{ item: TeamColorCatalogItem; overlap: number }> = [];

  for (const [key, meta] of counts) {
    if (meta.count < 2) continue;
    let official = catalogByName.get(key);
    if (!official) {
      for (const id of meta.ids) {
        const candidate = catalogById.get(id);
        if (candidate) {
          official = candidate;
          break;
        }
      }
    }
    if (!official || official.category !== "feature") continue;
    discovered.push({ item: official, overlap: meta.count });
  }

  const verified = new Map<number, TeamColorSearchItem>();
  for (let index = 0; index < discovered.length; index += 5) {
    const batch = await Promise.all(
      discovered.slice(index, index + 5).map(async ({ item, overlap }) => {
        const fit = await getRelatedFit(item, baseNames);
        return fit ? { item, overlap: Math.max(overlap, fit.matched) } : null;
      })
    );
    for (const result of batch) {
      if (!result) continue;
      verified.set(result.item.id, {
        ...result.item,
        related: true,
        overlap: result.overlap,
      });
    }
  }

  const stems = Array.from(verified.values())
    .map((item) => getRelationStem(item.name))
    .filter(Boolean);
  const stemKeys = Array.from(new Set(stems.map(normalize).filter((key) => key.length >= 4)));

  const expanded = catalog.filter((item) => {
    if (item.category !== "feature" || verified.has(item.id)) return false;
    const key = normalize(item.name);
    return stemKeys.some((stem) => key.startsWith(stem));
  });

  for (let index = 0; index < expanded.length; index += 5) {
    const batch = await Promise.all(
      expanded.slice(index, index + 5).map(async (item) => {
        const fit = await getRelatedFit(item, baseNames);
        return fit ? { item, overlap: fit.matched } : null;
      })
    );
    for (const result of batch) {
      if (!result) continue;
      verified.set(result.item.id, {
        ...result.item,
        related: true,
        overlap: result.overlap,
      });
    }
  }

  return Array.from(verified.values()).sort(
    (a, b) => (b.overlap ?? 0) - (a.overlap ?? 0) || a.name.localeCompare(b.name, "ko-KR")
  );
}

function directMatchScore(item: TeamColorCatalogItem, normalizedQuery: string) {
  const name = normalize(item.name);
  if (name === normalizedQuery) return 0;
  if (name.startsWith(normalizedQuery)) return 1;
  if (name.includes(normalizedQuery)) return 2;
  return 99;
}

async function searchTeamColors(query: string) {
  const normalizedQuery = normalize(query);
  const cached = queryCache.get(normalizedQuery);
  if (cached && cached.expiresAt > Date.now()) return cached.items;

  const catalog = await getCatalog();
  let direct: TeamColorSearchItem[] = catalog
    .filter((item) => normalize(item.name).includes(normalizedQuery))
    .sort((a, b) => {
      const score = directMatchScore(a, normalizedQuery) - directMatchScore(b, normalizedQuery);
      if (score !== 0) return score;
      if (a.category !== b.category) return a.category === "affiliation" ? -1 : 1;
      return a.name.localeCompare(b.name, "ko-KR");
    })
    .slice(0, 50)
    .map((item) => ({ ...item, related: false } satisfies TeamColorSearchItem));

  const exactAffiliation = catalog.find(
    (item) => item.category === "affiliation" && normalize(item.name) === normalizedQuery
  );
  const isNationalTeam = Boolean(exactAffiliation && nationNameKeys.has(normalizedQuery));
  if (isNationalTeam) {
    direct = direct.map((item) =>
      item.category === "feature" ? { ...item, related: true } : item
    );
  }

  let related: TeamColorSearchItem[] = [];
  if (exactAffiliation && !isNationalTeam) {
    try {
      related = await discoverRelatedTeamColors(exactAffiliation, catalog);
    } catch (error) {
      console.error("Related teamcolor discovery failed", {
        affiliation: exactAffiliation.name,
        error,
      });
    }
  }

  const merged = new Map<number, TeamColorSearchItem>();
  for (const item of direct) merged.set(item.id, item);
  for (const item of related) {
    const previous = merged.get(item.id);
    merged.set(item.id, previous ? { ...previous, overlap: item.overlap } : item);
  }

  const directIds = new Set(direct.map((item) => item.id));
  const items = Array.from(merged.values())
    .sort((a, b) => {
      const aDirect = directIds.has(a.id) ? 0 : 1;
      const bDirect = directIds.has(b.id) ? 0 : 1;
      if (aDirect !== bDirect) return aDirect - bDirect;
      if (!aDirect) {
        const score = directMatchScore(a, normalizedQuery) - directMatchScore(b, normalizedQuery);
        if (score !== 0) return score;
      }
      return (b.overlap ?? 0) - (a.overlap ?? 0) || a.name.localeCompare(b.name, "ko-KR");
    })
    .slice(0, 80);

  queryCache.set(normalizedQuery, { expiresAt: Date.now() + SEARCH_CACHE_MS, items });
  return items;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();
  const teamColorIdRaw = (searchParams.get("teamColorId") ?? "").trim();

  if (teamColorIdRaw) {
    const teamColorId = Number(teamColorIdRaw);
    if (!Number.isInteger(teamColorId) || teamColorId <= 0) {
      return NextResponse.json({ error: "올바르지 않은 팀컬러입니다." }, { status: 400 });
    }

    try {
      const catalog = await getCatalog();
      const teamColor = catalog.find((item) => item.id === teamColorId);
      if (!teamColor) {
        return NextResponse.json({ error: "팀컬러를 찾을 수 없습니다." }, { status: 404 });
      }
      const pageRaw = Number(searchParams.get("page") ?? "1");
      const page = Number.isInteger(pageRaw) && pageRaw > 0 ? Math.min(pageRaw, 500) : 1;
      const target = searchParams.get("target") === "gk" ? "gk" : "field";
      const pageSize = 30;
      const allCards = await getAllSeasonCardsForTeamColor(teamColor, target);
      const start = (page - 1) * pageSize;
      const players = allCards.slice(start, start + pageSize);
      return NextResponse.json(
        { teamColor, players, page, pageSize, total: allCards.length,
          totalPages: Math.max(1, Math.ceil(allCards.length / pageSize)),
          hasNext: start + pageSize < allCards.length },
        { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=21600" } }
      );
    } catch (error) {
      console.error("Teamcolor player lookup failed", { teamColorId, error });
      return NextResponse.json({ error: "팀컬러 적용 선수를 불러오지 못했습니다." }, { status: 500 });
    }
  }

  if (normalize(query).length < 2) {
    return NextResponse.json({ teamColors: [] });
  }
  if (query.length > 40) {
    return NextResponse.json({ error: "검색어가 너무 깁니다." }, { status: 400 });
  }

  try {
    const teamColors = await searchTeamColors(query);
    return NextResponse.json(
      { teamColors },
      { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } }
    );
  } catch (error) {
    console.error("Teamcolor search failed", { query, error });
    return NextResponse.json({ error: "팀컬러 검색에 실패했습니다." }, { status: 500 });
  }
}
