import { NextResponse } from "next/server";
import { calculatePositionOvrFromText } from "@/lib/fconline/positionOvr";

type TeamColorCategory = "affiliation" | "enhancement" | "relationship";

type SquadInput = {
  slotId: string;
  spid: number;
  position: string;
  grade: number;
};

type TeamColorOption = {
  name: string;
  id: number | null;
  emblemUrl: string | null;
};

type TeamColorInfo = TeamColorOption & {
  category: TeamColorCategory;
  count: number;
  level: number;
  maxLevel: number;
  maxRequired: number;
  effect: string;
};

type BasePlayerData = {
  player: SquadInput;
  html: string;
  baseOvr: number | null;
  affiliationOptions: TeamColorOption[];
  relationshipOptions: TeamColorOption[];
};

type Candidate = {
  option: TeamColorOption;
  count: number;
  eligibleSlots: Set<string>;
  info: Awaited<ReturnType<typeof fetchTeamInfo>>;
  level: number;
  category: "affiliation" | "relationship";
};

const PLAYER_ABILITY_URL = "https://fconline.nexon.com/datacenter/PlayerAbility";
const TEAM_COLOR_URL = "https://fconline.nexon.com/datacenter/teamcolor";
const CACHE_MS = 10 * 60 * 1000;
const abilityCache = new Map<string, { expiresAt: number; html: string }>();
const teamInfoCache = new Map<string, { expiresAt: number; info: ParsedTeamInfo }>();

const STAT_NAMES = [
  "전체 능력치",
  "GK 위치 선정",
  "GK 반응속도",
  "GK 다이빙",
  "GK 핸들링",
  "GK 킥",
  "슬라이딩 태클",
  "골 결정력",
  "중거리 슛",
  "위치 선정",
  "짧은 패스",
  "긴 패스",
  "볼 컨트롤",
  "반응 속도",
  "대인 수비",
  "가로채기",
  "페널티 킥",
  "슛 파워",
  "스태미너",
  "적극성",
  "민첩성",
  "밸런스",
  "드리블",
  "가속력",
  "프리킥",
  "몸싸움",
  "침착성",
  "발리슛",
  "크로스",
  "시야",
  "커브",
  "태클",
  "헤더",
  "점프",
  "속력",
] as const;

const ENHANCEMENT_RULES = [
  { name: "Lv.2 백금빛 물결", minGrade: 11, required: 8, level: 2, maxLevel: 2, bonus: 5 },
  { name: "Lv.1 백금빛 물결", minGrade: 11, required: 5, level: 1, maxLevel: 2, bonus: 4 },
  { name: "Lv.2 금빛 물결", minGrade: 8, required: 8, level: 2, maxLevel: 2, bonus: 4 },
  { name: "Lv.1 금빛 물결", minGrade: 8, required: 5, level: 1, maxLevel: 2, bonus: 3 },
  { name: "Lv.2 은빛 물결", minGrade: 5, required: 8, level: 2, maxLevel: 2, bonus: 3 },
  { name: "Lv.1 은빛 물결", minGrade: 5, required: 5, level: 1, maxLevel: 2, bonus: 1 },
  { name: "Lv.1 동빛 물결", minGrade: 3, required: 5, level: 1, maxLevel: 1, bonus: 1 },
] as const;

type ParsedTeamInfo = {
  name: string;
  id: number | null;
  emblemUrl: string | null;
  maxLevel: number;
  maxRequired: number;
  effect: string;
};

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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeAssetUrl(src: string, base = "https://fconline.nexon.com") {
  const cleaned = decodeHtmlEntities(src).trim().replace(/^['"]|['"]$/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("//")) return `https:${cleaned}`;
  if (cleaned.startsWith("/")) return `${base}${cleaned}`;
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  return null;
}

function parseIdFromMarkup(markup: string): number | null {
  const patterns = [
    /(?:n4TeamColorId|teamColorId|teamcolorid|data-teamcolor-id|data-color-id|data-sn|data-id)\s*(?:=|:)\s*["']?(\d+)/i,
    /data-value\s*=\s*["'](\d+)["']/i,
    /(?:TeamColor|teamcolor)[^\d]{0,50}(\d{2,})/i,
  ];
  for (const pattern of patterns) {
    const match = markup.match(pattern);
    if (!match) continue;
    const id = Number(match[1]);
    if (Number.isInteger(id) && id > 0) return id;
  }
  return null;
}

function parseImageFromMarkup(markup: string): string | null {
  const img = markup.match(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i)?.[1];
  if (img && !/rank0/i.test(img)) return normalizeAssetUrl(img);
  const background = markup.match(/background(?:-image)?\s*:\s*url\(([^)]+)\)/i)?.[1];
  if (background && !/rank0/i.test(background)) return normalizeAssetUrl(background);
  return null;
}

function parseOptionsBetween(html: string, startLabel: string, endLabel?: string): TeamColorOption[] {
  const start = html.indexOf(startLabel);
  if (start < 0) return [];
  const end = endLabel ? html.indexOf(endLabel, start + startLabel.length) : -1;
  const segment = html.slice(start, end > start ? end : Math.min(html.length, start + 40000));
  const result = new Map<string, TeamColorOption>();
  const blocks = segment.match(/<li\b[\s\S]*?<\/li>/gi) ?? [];

  for (const block of blocks) {
    const anchor = block.match(/<a\b[^>]*class=["'][^"']*\bselector_item\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
    if (!anchor) continue;
    const name = htmlToText(anchor[1]);
    if (!name || name === startLabel || name === "단일팀") continue;
    const option = { name, id: parseIdFromMarkup(block), emblemUrl: parseImageFromMarkup(block) };
    const previous = result.get(name);
    result.set(name, {
      name,
      id: previous?.id ?? option.id,
      emblemUrl: previous?.emblemUrl ?? option.emblemUrl,
    });
  }

  return Array.from(result.values());
}

function parsePositionOvr(html: string, position: string): number | null {
  const text = htmlToText(html);
  const escaped = escapeRegExp(position.toUpperCase());
  const endCandidates = [text.indexOf("클래스 비교"), text.indexOf("총 능력치")].filter((index) => index > 0);
  const end = endCandidates.length ? Math.min(...endCandidates) : Math.min(text.length, 3000);
  const header = text.slice(0, end);
  const match =
    header.match(new RegExp(`(?:^|\\s)${escaped}\\s+(\\d{2,3})(?=\\s|$)`)) ??
    header.match(new RegExp(`(?:^|\\s)(\\d{2,3})\\s+${escaped}(?=\\s|$)`));
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 40 && value <= 250 ? value : null;
}

function parseEffectParts(text: string) {
  const result: string[] = [];
  for (const stat of STAT_NAMES) {
    const match = text.match(new RegExp(`${escapeRegExp(stat)}\\s*\\+(\\d+)`));
    if (match) result.push(`${stat} +${match[1]}`);
  }
  return result;
}

function parseTeamInfoHtml(html: string, name: string, fallback: TeamColorOption): ParsedTeamInfo {
  const text = htmlToText(html);
  const indexes: number[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const index = text.indexOf(name, cursor);
    if (index < 0) break;
    indexes.push(index);
    cursor = index + name.length;
  }

  let chosen = indexes[indexes.length - 1] ?? -1;
  for (const index of indexes) {
    if (/\d단계/.test(text.slice(index + name.length, index + name.length + 100))) chosen = index;
  }
  const before = chosen >= 0 ? text.slice(Math.max(0, chosen - 50), chosen) : "";
  const after = chosen >= 0 ? text.slice(chosen + name.length, chosen + name.length + 320) : "";
  const maxRequired = Number(before.match(/(\d{1,2})\s*$/)?.[1] ?? 11);
  const maxLevel = Number(after.match(/([1-4])단계/)?.[1] ?? 4);
  const effect = parseEffectParts(after).slice(0, 5).join(" · ");
  const rawIndex = html.lastIndexOf(name);
  const rawWindow = rawIndex >= 0 ? html.slice(Math.max(0, rawIndex - 1600), Math.min(html.length, rawIndex + 2200)) : "";

  return {
    name,
    id: fallback.id ?? parseIdFromMarkup(rawWindow),
    emblemUrl: fallback.emblemUrl ?? parseImageFromMarkup(rawWindow),
    maxLevel: Number.isFinite(maxLevel) && maxLevel >= 1 && maxLevel <= 4 ? maxLevel : 4,
    maxRequired: Number.isFinite(maxRequired) && maxRequired >= 2 && maxRequired <= 11 ? maxRequired : 11,
    effect,
  };
}

async function fetchTeamInfo(option: TeamColorOption) {
  const cached = teamInfoCache.get(option.name);
  if (cached && cached.expiresAt > Date.now()) return cached.info;
  try {
    const response = await fetch(`${TEAM_COLOR_URL}?strTeamColorName=${encodeURIComponent(option.name)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
      next: { revalidate: 600 },
    });
    if (!response.ok) throw new Error(`team color request failed: ${response.status}`);
    const info = parseTeamInfoHtml(await response.text(), option.name, option);
    teamInfoCache.set(option.name, { expiresAt: Date.now() + CACHE_MS, info });
    return info;
  } catch {
    return { name: option.name, id: option.id, emblemUrl: option.emblemUrl, maxLevel: 4, maxRequired: 11, effect: "" };
  }
}

async function fetchPlayerAbility(player: SquadInput) {
  const cacheKey = `${player.spid}:${player.grade}:4`;
  const cached = abilityCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.html;
  const body = new URLSearchParams({
    spid: String(player.spid),
    n1Strong: String(Math.min(13, Math.max(1, player.grade))),
    n1Grow: "4",
    n4TeamColorId: "0",
    n4TeamColorLv: "0",
    n1Change: "0",
    strPlayerImg: `https://fo4.dn.nexoncdn.co.kr/live/externalAssets/common/playersAction/p${player.spid}.png`,
    rd: "0",
  });
  const response = await fetch(PLAYER_ABILITY_URL, {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ko-KR,ko;q=0.9",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Referer: `https://fconline.nexon.com/DataCenter/PlayerInfo?spid=${player.spid}`,
      "X-Requested-With": "XMLHttpRequest",
    },
    body,
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`player ability request failed: ${response.status}`);
  const html = await response.text();
  abilityCache.set(cacheKey, { expiresAt: Date.now() + CACHE_MS, html });
  return html;
}

function getLevelFromCount(count: number, maxLevel: number, maxRequired: number) {
  if (maxLevel <= 0) return 0;
  if (maxLevel === 1) return count >= maxRequired ? 1 : 0;
  const thresholds = [3, 6, 8, 11].slice(0, maxLevel);
  thresholds[maxLevel - 1] = maxRequired > 0 ? maxRequired : thresholds[maxLevel - 1];
  let level = 0;
  thresholds.forEach((required, index) => {
    if (count >= required) level = index + 1;
  });
  return Math.min(level, maxLevel);
}

function effectForLevel(info: ParsedTeamInfo, level: number) {
  if (level <= 0) return "";
  if (level === info.maxLevel && info.effect) return info.effect;
  return `전체 능력치 +${level}`;
}

function parseAbilityValues(html: string) {
  const text = htmlToText(html);
  const marker = text.lastIndexOf("총 능력치");
  const section = marker >= 0 ? text.slice(marker) : text;
  const values: Record<string, number> = {};
  for (const stat of STAT_NAMES) {
    if (stat === "전체 능력치") continue;
    const match = section.match(new RegExp(`${escapeRegExp(stat)}\\s+(\\d{1,3})(?=\\s|$)`));
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value)) values[stat] = value;
  }
  return values;
}

function applyEffectsToOvr(html: string, position: string, exactBaseOvr: number | null, effects: string[]) {
  if (effects.length === 0) return exactBaseOvr;
  const base = parseAbilityValues(html);
  const stats = Object.keys(base);
  if (stats.length === 0) return exactBaseOvr;
  const adjusted = { ...base };

  for (const effect of effects) {
    const overall = Number(effect.match(/전체 능력치\s*\+(\d+)/)?.[1] ?? 0);
    if (overall > 0) {
      for (const stat of stats) adjusted[stat] = (adjusted[stat] ?? 0) + overall;
    }
    for (const stat of STAT_NAMES) {
      if (stat === "전체 능력치") continue;
      const amount = Number(effect.match(new RegExp(`${escapeRegExp(stat)}\\s*\\+(\\d+)`))?.[1] ?? 0);
      if (amount > 0 && adjusted[stat] !== undefined) adjusted[stat] += amount;
    }
  }

  const toText = (values: Record<string, number>) =>
    `능력치 전체 ${Object.entries(values).map(([name, value]) => `${name} ${value}`).join(" ")} 출생`;
  const weightedBase = calculatePositionOvrFromText(toText(base), position);
  const weightedAdjusted = calculatePositionOvrFromText(toText(adjusted), position);
  if (weightedBase === null || weightedAdjusted === null) return exactBaseOvr;
  const delta = weightedAdjusted - weightedBase;
  return exactBaseOvr === null ? weightedAdjusted : exactBaseOvr + delta;
}

function gainForEffect(item: BasePlayerData, effect: string) {
  const adjusted = applyEffectsToOvr(item.html, item.player.position, item.baseOvr, [effect]);
  if (adjusted === null || item.baseOvr === null) return 0;
  return adjusted - item.baseOvr;
}

async function buildCandidates(basePlayers: BasePlayerData[], category: "affiliation" | "relationship") {
  const map = new Map<string, { option: TeamColorOption; count: number; eligibleSlots: Set<string> }>();
  for (const item of basePlayers) {
    const options = category === "affiliation" ? item.affiliationOptions : item.relationshipOptions;
    const seen = new Set<string>();
    for (const option of options) {
      if (seen.has(option.name)) continue;
      seen.add(option.name);
      const current = map.get(option.name) ?? { option, count: 0, eligibleSlots: new Set<string>() };
      current.count += 1;
      current.eligibleSlots.add(item.player.slotId);
      current.option = {
        name: option.name,
        id: current.option.id ?? option.id,
        emblemUrl: current.option.emblemUrl ?? option.emblemUrl,
      };
      map.set(option.name, current);
    }
  }

  const raw = Array.from(map.values()).filter((item) => item.count >= 2).slice(0, 30);
  const enriched = await Promise.all(
    raw.map(async (candidate) => {
      const info = await fetchTeamInfo(candidate.option);
      const level = getLevelFromCount(candidate.count, info.maxLevel, info.maxRequired);
      return { ...candidate, info, level, category } satisfies Candidate;
    })
  );
  return enriched.filter((candidate) => candidate.level > 0);
}

function chooseCandidateForPlayer(item: BasePlayerData, candidates: Candidate[]) {
  const eligible = candidates.filter((candidate) => candidate.eligibleSlots.has(item.player.slotId));
  if (eligible.length === 0) return null;
  return eligible
    .map((candidate) => ({ candidate, gain: gainForEffect(item, effectForLevel(candidate.info, candidate.level)) }))
    .sort((a, b) => b.gain - a.gain || b.candidate.level - a.candidate.level || b.candidate.count - a.candidate.count)[0]
    ?.candidate ?? null;
}

function selectEnhancement(players: SquadInput[]) {
  for (const rule of ENHANCEMENT_RULES) {
    const count = players.filter((player) => player.grade >= rule.minGrade).length;
    if (count >= rule.required) return { ...rule, count };
  }
  return null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const rawPlayers = Array.isArray((body as { players?: unknown[] })?.players) ? (body as { players: unknown[] }).players : [];
  const players: SquadInput[] = rawPlayers
    .map((item) => item as Partial<SquadInput>)
    .filter((item) => typeof item.slotId === "string" && Number.isInteger(item.spid) && Number(item.spid) > 0 && typeof item.position === "string" && Number.isInteger(item.grade))
    .slice(0, 11)
    .map((item) => ({
      slotId: item.slotId as string,
      spid: Number(item.spid),
      position: String(item.position).toUpperCase(),
      grade: Math.min(13, Math.max(1, Number(item.grade))),
    }));

  if (players.length === 0) {
    return NextResponse.json({ adaptation: 5, teamColors: [], ovrBySlot: {}, appliedBySlot: {} });
  }

  try {
    const basePlayers: BasePlayerData[] = await Promise.all(
      players.map(async (player) => {
        const html = await fetchPlayerAbility(player);
        return {
          player,
          html,
          baseOvr: parsePositionOvr(html, player.position),
          affiliationOptions: parseOptionsBetween(html, "소속 팀컬러", "관계 팀컬러"),
          relationshipOptions: parseOptionsBetween(html, "관계 팀컬러", "클래스 비교"),
        };
      })
    );

    const [affiliationCandidates, relationshipCandidates] = await Promise.all([
      buildCandidates(basePlayers, "affiliation"),
      buildCandidates(basePlayers, "relationship"),
    ]);
    const enhancement = selectEnhancement(players);

    const appliedBySlot: Record<
      string,
      { affiliation: string | null; enhancement: string | null; relationship: string | null }
    > = {};
    const selectedTeamColorMap = new Map<string, TeamColorInfo>();
    const ovrBySlot: Record<string, number | null> = {};

    for (const item of basePlayers) {
      const affiliation = chooseCandidateForPlayer(item, affiliationCandidates);
      const relationship = chooseCandidateForPlayer(item, relationshipCandidates);
      const effects: string[] = [];

      if (affiliation) {
        const effect = effectForLevel(affiliation.info, affiliation.level);
        if (effect) effects.push(effect);
        selectedTeamColorMap.set(`affiliation:${affiliation.option.name}`, {
          name: affiliation.option.name,
          category: "affiliation",
          id: affiliation.info.id ?? affiliation.option.id,
          emblemUrl: affiliation.info.emblemUrl ?? affiliation.option.emblemUrl,
          count: affiliation.count,
          level: affiliation.level,
          maxLevel: affiliation.info.maxLevel,
          maxRequired: affiliation.info.maxRequired,
          effect,
        });
      }

      if (relationship) {
        const effect = effectForLevel(relationship.info, relationship.level);
        if (effect) effects.push(effect);
        selectedTeamColorMap.set(`relationship:${relationship.option.name}`, {
          name: relationship.option.name,
          category: "relationship",
          id: relationship.info.id ?? relationship.option.id,
          emblemUrl: relationship.info.emblemUrl ?? relationship.option.emblemUrl,
          count: relationship.count,
          level: relationship.level,
          maxLevel: relationship.info.maxLevel,
          maxRequired: relationship.info.maxRequired,
          effect,
        });
      }

      const enhancementApplies = enhancement ? item.player.grade >= enhancement.minGrade : false;
      if (enhancement && enhancementApplies) {
        const effect = `전체 능력치 +${enhancement.bonus}`;
        effects.push(effect);
        selectedTeamColorMap.set(`enhancement:${enhancement.name}`, {
          name: enhancement.name,
          category: "enhancement",
          id: null,
          emblemUrl: null,
          count: enhancement.count,
          level: enhancement.level,
          maxLevel: enhancement.maxLevel,
          maxRequired: enhancement.required,
          effect,
        });
      }

      appliedBySlot[item.player.slotId] = {
        affiliation: affiliation?.option.name ?? null,
        enhancement: enhancement && enhancementApplies ? enhancement.name : null,
        relationship: relationship?.option.name ?? null,
      };
      ovrBySlot[item.player.slotId] = applyEffectsToOvr(
        item.html,
        item.player.position,
        item.baseOvr,
        effects
      );
    }

    return NextResponse.json(
      {
        adaptation: 5,
        teamColors: Array.from(selectedTeamColorMap.values()),
        ovrBySlot,
        appliedBySlot,
      },
      { headers: { "Cache-Control": "private, max-age=0, must-revalidate" } }
    );
  } catch (error) {
    console.error("Squad team color calculation failed", error);
    return NextResponse.json(
      { adaptation: 5, teamColors: [], ovrBySlot: {}, appliedBySlot: {} },
      { status: 200 }
    );
  }
}
