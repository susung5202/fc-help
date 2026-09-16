import { NextResponse } from "next/server";

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
  count: number;
  level: number;
  maxLevel: number;
  maxRequired: number;
  effect: string;
  allAbilityBonus: number;
};

type BasePlayerData = {
  player: SquadInput;
  html: string;
  baseOvr: number | null;
  options: TeamColorOption[];
};

const PLAYER_ABILITY_URL = "https://fconline.nexon.com/datacenter/PlayerAbility";
const TEAM_COLOR_URL = "https://fconline.nexon.com/datacenter/teamcolor";
const CACHE_MS = 10 * 60 * 1000;
const abilityCache = new Map<string, { expiresAt: number; html: string }>();
const teamInfoCache = new Map<string, { expiresAt: number; info: Omit<TeamColorInfo, "count" | "level"> }>();

const STAT_NAMES = [
  "전체 능력치",
  "속력",
  "가속력",
  "골 결정력",
  "슛 파워",
  "중거리 슛",
  "위치 선정",
  "발리슛",
  "페널티 킥",
  "짧은 패스",
  "시야",
  "크로스",
  "긴 패스",
  "프리킥",
  "커브",
  "드리블",
  "볼 컨트롤",
  "민첩성",
  "밸런스",
  "반응 속도",
  "대인 수비",
  "태클",
  "가로채기",
  "헤더",
  "슬라이딩 태클",
  "몸싸움",
  "스태미너",
  "적극성",
  "점프",
  "침착성",
  "GK 다이빙",
  "GK 핸들링",
  "GK 킥",
  "GK 반응속도",
  "GK 위치 선정",
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

function parseAffiliationOptions(html: string): TeamColorOption[] {
  const affiliationStart = html.indexOf("소속 팀컬러");
  const relationshipStart = affiliationStart >= 0 ? html.indexOf("관계 팀컬러", affiliationStart + 1) : -1;
  const segment =
    affiliationStart >= 0
      ? html.slice(
          affiliationStart,
          relationshipStart > affiliationStart ? relationshipStart : Math.min(html.length, affiliationStart + 30000)
        )
      : html;

  const result = new Map<string, TeamColorOption>();
  const listItems = segment.match(/<li\b[\s\S]*?<\/li>/gi) ?? [];

  for (const block of listItems) {
    const anchor = block.match(
      /<a\b[^>]*class=["'][^"']*\bselector_item\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/i
    );
    if (!anchor) continue;
    const name = htmlToText(anchor[1]);
    if (!name || name === "소속 팀컬러" || name === "단일팀" || /^Lv\.\s*\d/i.test(name)) continue;

    const option: TeamColorOption = {
      name,
      id: parseIdFromMarkup(block),
      emblemUrl: parseImageFromMarkup(block),
    };
    const current = result.get(name);
    result.set(name, {
      name,
      id: current?.id ?? option.id,
      emblemUrl: current?.emblemUrl ?? option.emblemUrl,
    });
  }

  if (result.size === 0) {
    const anchors = segment.matchAll(
      /<a\b([^>]*)class=["'][^"']*\bselector_item\b[^"']*["']([^>]*)>([\s\S]*?)<\/a>/gi
    );
    for (const anchor of anchors) {
      const name = htmlToText(anchor[3]);
      if (!name || name === "소속 팀컬러" || name === "단일팀" || /^Lv\.\s*\d/i.test(name)) continue;
      const markup = `${anchor[1]} ${anchor[2]}`;
      result.set(name, {
        name,
        id: parseIdFromMarkup(markup),
        emblemUrl: parseImageFromMarkup(markup),
      });
    }
  }

  return Array.from(result.values());
}

function parsePositionOvr(html: string, position: string): number | null {
  const text = htmlToText(html);
  const escaped = escapeRegExp(position.toUpperCase());
  const preferredEnd = [text.indexOf("클래스 비교"), text.indexOf("총 능력치")]
    .filter((index) => index > 0)
    .sort((a, b) => a - b)[0];
  const header = text.slice(0, preferredEnd ?? Math.min(text.length, 2500));

  const positionFirst = header.match(
    new RegExp(`(?:^|\\s)${escaped}\\s+(\\d{2,3})(?=\\s|$)`)
  );
  const valueFirst = header.match(
    new RegExp(`(?:^|\\s)(\\d{2,3})\\s+${escaped}(?=\\s|$)`)
  );
  const match = positionFirst ?? valueFirst;
  if (!match) return null;

  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 40 && value <= 250 ? value : null;
}

function getLevelFromCount(count: number, maxLevel: number, maxRequired: number) {
  if (maxLevel <= 0) return 0;
  if (maxLevel === 1) return count >= maxRequired ? 1 : 0;

  const standardThresholds = [3, 6, 8, 11];
  const thresholds = standardThresholds.slice(0, maxLevel);
  thresholds[maxLevel - 1] = maxRequired > 0 ? maxRequired : thresholds[maxLevel - 1];

  let level = 0;
  thresholds.forEach((required, index) => {
    if (count >= required) level = index + 1;
  });
  return Math.min(level, maxLevel);
}

function parseEffectParts(text: string) {
  const result: string[] = [];
  for (const stat of STAT_NAMES) {
    const match = text.match(new RegExp(`${escapeRegExp(stat)}\\s*\\+(\\d+)`));
    if (!match) continue;
    result.push(`${stat} +${match[1]}`);
  }
  return result;
}

function parseTeamInfoHtml(html: string, name: string, fallback: TeamColorOption) {
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
    const after = text.slice(index + name.length, index + name.length + 90);
    if (/\d단계/.test(after)) chosen = index;
  }

  const before = chosen >= 0 ? text.slice(Math.max(0, chosen - 35), chosen) : "";
  const after = chosen >= 0 ? text.slice(chosen + name.length, chosen + name.length + 260) : "";
  const maxRequired = Number(before.match(/(\d{1,2})\s*$/)?.[1] ?? 11);
  const maxLevel = Number(after.match(/([1-4])단계/)?.[1] ?? 4);
  const effectWindow = after.replace(/^\s*[1-4]단계\s*/, "");
  const effectParts = parseEffectParts(effectWindow).slice(0, 4);
  const effect = effectParts.join(" · ");
  const allAbilityBonus = Number(
    effectParts.find((part) => part.startsWith("전체 능력치"))?.match(/\+(\d+)/)?.[1] ?? 0
  );

  let rawWindow = "";
  const rawIndex = html.lastIndexOf(name);
  if (rawIndex >= 0) {
    rawWindow = html.slice(Math.max(0, rawIndex - 1400), Math.min(html.length, rawIndex + 1800));
  }

  return {
    name,
    id: fallback.id ?? parseIdFromMarkup(rawWindow),
    emblemUrl: fallback.emblemUrl ?? parseImageFromMarkup(rawWindow),
    maxLevel: Number.isFinite(maxLevel) && maxLevel >= 1 && maxLevel <= 4 ? maxLevel : 4,
    maxRequired:
      Number.isFinite(maxRequired) && maxRequired >= 2 && maxRequired <= 11 ? maxRequired : 11,
    effect,
    allAbilityBonus,
  };
}

async function fetchTeamInfo(option: TeamColorOption) {
  const cached = teamInfoCache.get(option.name);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.info,
      id: option.id ?? cached.info.id,
      emblemUrl: option.emblemUrl ?? cached.info.emblemUrl,
    };
  }

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
    const html = await response.text();
    const info = parseTeamInfoHtml(html, option.name, option);
    teamInfoCache.set(option.name, { expiresAt: Date.now() + CACHE_MS, info });
    return info;
  } catch {
    return {
      name: option.name,
      id: option.id,
      emblemUrl: option.emblemUrl,
      maxLevel: 4,
      maxRequired: 11,
      effect: "",
      allAbilityBonus: 0,
    };
  }
}

async function fetchPlayerAbility(
  player: SquadInput,
  teamColorId = 0,
  teamColorLevel = 0
) {
  const cacheKey = `${player.spid}:${player.grade}:4:${teamColorId}:${teamColorLevel}`;
  const cached = abilityCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.html;

  const body = new URLSearchParams({
    spid: String(player.spid),
    n1Strong: String(Math.min(13, Math.max(1, player.grade))),
    n1Grow: "4",
    n4TeamColorId: String(teamColorId),
    n4TeamColorLv: String(teamColorLevel),
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

function effectForLevel(info: Omit<TeamColorInfo, "count" | "level">, level: number) {
  if (level === info.maxLevel && info.effect) return info.effect;
  if (level > 0) return `전체 능력치 +${level}`;
  return "";
}

function allAbilityForLevel(info: Omit<TeamColorInfo, "count" | "level">, level: number) {
  if (level === info.maxLevel && info.effect) return info.allAbilityBonus;
  return level > 0 ? level : 0;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const rawPlayers = Array.isArray((body as { players?: unknown[] })?.players)
    ? (body as { players: unknown[] }).players
    : [];
  const players: SquadInput[] = rawPlayers
    .map((item) => item as Partial<SquadInput>)
    .filter(
      (item) =>
        typeof item.slotId === "string" &&
        Number.isInteger(item.spid) &&
        Number(item.spid) > 0 &&
        typeof item.position === "string" &&
        Number.isInteger(item.grade)
    )
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
          options: parseAffiliationOptions(html),
        };
      })
    );

    const candidateMap = new Map<
      string,
      { count: number; option: TeamColorOption; eligibleSlots: Set<string> }
    >();

    for (const item of basePlayers) {
      const seen = new Set<string>();
      for (const option of item.options) {
        if (seen.has(option.name)) continue;
        seen.add(option.name);
        const current = candidateMap.get(option.name) ?? {
          count: 0,
          option,
          eligibleSlots: new Set<string>(),
        };
        current.count += 1;
        current.eligibleSlots.add(item.player.slotId);
        current.option = {
          name: option.name,
          id: current.option.id ?? option.id,
          emblemUrl: current.option.emblemUrl ?? option.emblemUrl,
        };
        candidateMap.set(option.name, current);
      }
    }

    const rawCandidates = Array.from(candidateMap.values())
      .filter((candidate) => candidate.count >= 3)
      .sort((a, b) => b.count - a.count || a.option.name.localeCompare(b.option.name, "ko"))
      .slice(0, 12);

    const enrichedCandidates = (
      await Promise.all(
        rawCandidates.map(async (candidate) => {
          const info = await fetchTeamInfo(candidate.option);
          const level = getLevelFromCount(candidate.count, info.maxLevel, info.maxRequired);
          return { ...candidate, info, level };
        })
      )
    )
      .filter((candidate) => candidate.level > 0)
      .sort(
        (a, b) =>
          b.level - a.level ||
          b.count - a.count ||
          b.info.allAbilityBonus - a.info.allAbilityBonus ||
          a.option.name.localeCompare(b.option.name, "ko")
      );

    const appliedBySlot: Record<string, string | null> = Object.fromEntries(
      players.map((player) => [player.slotId, null])
    );
    const selectedColors: Array<{
      candidate: (typeof enrichedCandidates)[number];
      assignedSlots: string[];
    }> = [];

    for (const candidate of enrichedCandidates) {
      const assignedSlots = Array.from(candidate.eligibleSlots).filter(
        (slotId) => !appliedBySlot[slotId]
      );
      if (assignedSlots.length === 0) continue;
      assignedSlots.forEach((slotId) => {
        appliedBySlot[slotId] = candidate.option.name;
      });
      selectedColors.push({ candidate, assignedSlots });
    }

    const selectedMap = new Map(
      selectedColors.map(({ candidate }) => [candidate.option.name, candidate])
    );

    const ovrEntries = await Promise.all(
      basePlayers.map(async (item) => {
        const appliedName = appliedBySlot[item.player.slotId];
        const candidate = appliedName ? selectedMap.get(appliedName) : null;
        if (!candidate) return [item.player.slotId, item.baseOvr] as const;

        const teamColorId = candidate.info.id ?? candidate.option.id;
        if (teamColorId) {
          try {
            const html = await fetchPlayerAbility(item.player, teamColorId, candidate.level);
            const exact = parsePositionOvr(html, item.player.position);
            if (exact !== null) return [item.player.slotId, exact] as const;
          } catch {
            // 공식 팀컬러 적용 요청 실패 시 아래 보정값으로 내려간다.
          }
        }

        const bonus = allAbilityForLevel(candidate.info, candidate.level);
        return [
          item.player.slotId,
          item.baseOvr === null ? null : item.baseOvr + bonus,
        ] as const;
      })
    );

    const teamColors: TeamColorInfo[] = selectedColors.map(({ candidate }) => ({
      name: candidate.option.name,
      id: candidate.info.id ?? candidate.option.id,
      emblemUrl: candidate.info.emblemUrl ?? candidate.option.emblemUrl,
      count: candidate.count,
      level: candidate.level,
      maxLevel: candidate.info.maxLevel,
      maxRequired: candidate.info.maxRequired,
      effect: effectForLevel(candidate.info, candidate.level),
      allAbilityBonus: allAbilityForLevel(candidate.info, candidate.level),
    }));

    return NextResponse.json(
      {
        adaptation: 5,
        teamColors,
        ovrBySlot: Object.fromEntries(ovrEntries),
        appliedBySlot,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=0, must-revalidate",
        },
      }
    );
  } catch (error) {
    console.error("Squad team color calculation failed", error);
    return NextResponse.json(
      { adaptation: 5, teamColors: [], ovrBySlot: {}, appliedBySlot: {} },
      { status: 200 }
    );
  }
}
