export type TeamColorEffect = {
  label: string;
  value: number;
};

export type TeamColorCategory = "reinforcement" | "affiliation" | "feature";

export type TeamColorOption = {
  name: string;
  maxLevel: number;
  level: number;
  effects: TeamColorEffect[];
  category?: TeamColorCategory;
};

export type PlayerTeamColors = {
  reinforcement: TeamColorOption[];
  affiliation: TeamColorOption[];
  feature: TeamColorOption[];
};

const EFFECT_LABELS = [
  "전체 능력치",
  "GK 위치 선정",
  "GK 반응속도",
  "GK 핸들링",
  "GK 다이빙",
  "슬라이딩 태클",
  "반응 속도",
  "골 결정력",
  "볼 컨트롤",
  "중거리 슛",
  "위치 선정",
  "페널티 킥",
  "짧은 패스",
  "긴 패스",
  "대인 수비",
  "가로채기",
  "슛 파워",
  "가속력",
  "드리블",
  "민첩성",
  "밸런스",
  "크로스",
  "프리킥",
  "커브",
  "태클",
  "헤더",
  "몸싸움",
  "스태미너",
  "적극성",
  "점프",
  "침착성",
  "발리슛",
  "속력",
  "시야",
  "GK 킥",
] as const;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

function normalizeName(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function parseEffects(raw: string): TeamColorEffect[] {
  const labelPattern = EFFECT_LABELS.map(escapeRegExp).join("|");
  const effectPattern = new RegExp(`(${labelPattern})\\s*\\+(\\d+)`, "g");
  const result: TeamColorEffect[] = [];

  for (const match of raw.matchAll(effectPattern)) {
    const value = Number(match[2]);
    if (!Number.isFinite(value)) continue;
    result.push({ label: match[1], value });
  }

  return result;
}

function parseTeamColors(html: string): TeamColorOption[] {
  const text = htmlToText(html);
  const labelPattern = EFFECT_LABELS.map(escapeRegExp).join("|");
  const effectsBlock = `(?:(?:${labelPattern})\\s*\\+\\d+\\s*){1,10}`;
  const rowPattern = new RegExp(
    `(?:^|\\s)([1-9]|1[0-3])\\s+(.{1,90}?)\\s+(\\d+)단계\\s+(${effectsBlock})`,
    "g"
  );

  const rows: TeamColorOption[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(rowPattern)) {
    const maxLevel = Number(match[1]);
    const name = match[2].trim();
    const level = Number(match[3]);
    const effects = parseEffects(match[4]);
    if (!name || effects.length === 0) continue;

    const key = `${name}|${level}|${effects.map((e) => `${e.label}:${e.value}`).join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ name, maxLevel, level, effects });
  }

  return rows;
}

function getReinforcementTeamColors(strong: number): TeamColorOption[] {
  const rows: TeamColorOption[] = [];

  const add = (name: string, level: number, bonus: number, maxLevel: number) => {
    rows.push({
      name,
      level,
      maxLevel,
      effects: [{ label: "전체 능력치", value: bonus }],
      category: "reinforcement",
    });
  };

  // FC 온라인 공식 강화 팀컬러 기준.
  // 동빛: 3강+, 은빛: 5강+, 금빛: 8강+, 백금빛: 11강+
  if (strong >= 11) {
    add("백금빛 물결", 1, 4, 2);
    add("백금빛 물결", 2, 5, 2);
  }

  if (strong >= 8) {
    add("금빛 물결", 1, 3, 2);
    add("금빛 물결", 2, 4, 2);
  }

  if (strong >= 5) {
    add("은빛 물결", 1, 1, 2);
    add("은빛 물결", 2, 3, 2);
  }

  if (strong >= 3) {
    add("동빛 물결", 1, 1, 1);
  }

  return rows;
}

export async function searchTeamColors(query: string): Promise<TeamColorOption[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = new URL("https://fconline.nexon.com/datacenter/teamcolor");
  url.searchParams.set("strTeamColorCategory", "");
  url.searchParams.set("strTeamColorType", "");
  url.searchParams.set("strCategory", "");
  url.searchParams.set("strTeamColorName", trimmed);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) return [];
    return parseTeamColors(await response.text()).slice(0, 60);
  } catch (error) {
    console.error("FC Online team color fetch failed", error);
    return [];
  }
}

async function resolveNames(
  names: string[],
  category: TeamColorCategory
): Promise<TeamColorOption[]> {
  const groups = await Promise.all(
    names.map(async (name) => {
      const rows = await searchTeamColors(name);

      // 반드시 정확히 같은 팀컬러만 허용한다.
      // 검색 결과 첫 행으로 대체하면 '레알 마드리드'가
      // '19-20 레알 마드리드'로 잘못 바뀌는 문제가 생긴다.
      const exact = rows.filter(
        (row) => normalizeName(row.name) === normalizeName(name)
      );

      return exact.map((row) => ({ ...row, category }));
    })
  );

  const seen = new Set<string>();
  return groups.flat().filter((row) => {
    const key = `${row.name}|${row.level}|${category}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractSelectorNames(html: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const itemPattern = /<a\b[^>]*class=["'][^"']*\bselector_item\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(itemPattern)) {
    const name = htmlToText(match[1]).replace(/^선택\s*/, "").trim();
    if (!name) continue;
    if (
      name === "강화 팀컬러" ||
      name === "소속 팀컬러" ||
      name === "관계 팀컬러" ||
      name === "특성 팀컬러" ||
      name === "단일팀" ||
      /^Lv\.\d+/i.test(name)
    ) {
      continue;
    }

    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }

  return names.slice(0, 50);
}

async function getPlayerAbilityHtml(spid: number, strong: number) {
  const sourceUrl = `https://fconline.nexon.com/DataCenter/PlayerInfo?n1Strong=${strong}&spid=${spid}`;
  const body = new URLSearchParams({
    spid: String(spid),
    n1Strong: String(strong),
    n1Grow: "0",
    n4TeamColorId: "0",
    n4TeamColorLv: "0",
    n1Change: "0",
    strPlayerImg: `https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/playersAction/p${spid}.png`,
    rd: "0",
  });

  const response = await fetch("https://fconline.nexon.com/datacenter/PlayerAbility", {
    method: "POST",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      Referer: sourceUrl,
      Origin: "https://fconline.nexon.com",
    },
    body,
    next: { revalidate: 3600 },
  });

  return response.ok ? response.text() : "";
}

export async function getPlayerTeamColors(
  spid: number,
  strong: number
): Promise<PlayerTeamColors> {
  const safeStrong = Math.min(13, Math.max(1, Math.trunc(strong)));
  const reinforcement = getReinforcementTeamColors(safeStrong);

  try {
    const abilityHtml = await getPlayerAbilityHtml(spid, safeStrong);

    // PlayerAbility의 selector_item 목록은 해당 선수에게 실제로 노출되는
    // 소속 팀컬러 후보다. 전체 팀컬러 검색 페이지를 섞지 않는다.
    const affiliationNames = extractSelectorNames(abilityHtml);
    const affiliation = await resolveNames(affiliationNames, "affiliation");

    // 관계/특성 팀컬러는 현재 PlayerAbility에서 별도 selector가 확실히
    // 식별되는 경우에만 추후 추가한다. 잘못된 팀컬러를 보여주는 것보다
    // 빈 목록이 안전하다.
    const feature: TeamColorOption[] = [];

    return { reinforcement, affiliation, feature };
  } catch (error) {
    console.error("FC Online player team color fetch failed", error);
    return { reinforcement, affiliation: [], feature: [] };
  }
}
