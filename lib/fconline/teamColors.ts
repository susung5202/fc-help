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

function extractSimpleClassText(
  html: string,
  tagName: "div" | "span",
  className: string
) {
  const pattern = new RegExp(
    `<${tagName}\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/${tagName}>`,
    "i"
  );
  const match = html.match(pattern);
  return match ? htmlToText(match[1]) : "";
}

function parseEffectText(raw: string): TeamColorEffect | null {
  const text = raw.trim();
  const match = text.match(/^(.+?)\s*\+\s*(-?\d+)$/);
  if (!match) return null;

  const label = match[1].replace(/\s+/g, " ").trim();
  const value = Number(match[2]);
  if (!Number.isFinite(value)) return null;

  // FC 온라인에서 실제로 쓰는 세부 능력치만 허용한다.
  const canonical = EFFECT_LABELS.find(
    (candidate) => candidate.replace(/\s+/g, "") === label.replace(/\s+/g, "")
  );

  return canonical ? { label: canonical, value } : null;
}

function parseTeamColors(html: string): TeamColorOption[] {
  // 공식 데이터센터의 실제 마크업:
  // div.teamcolor_item > div.name / div.level / div.desc span.item
  // 텍스트 전체를 정규식으로 추측하지 않고 각 팀컬러 카드 단위로 읽는다.
  const blocks = extractDivBlocksByClass(html, "teamcolor_item");
  const rows: TeamColorOption[] = [];
  const seen = new Set<string>();

  for (const block of blocks) {
    const rawName = extractSimpleClassText(block, "div", "name");
    const name = rawName.replace(/^\d+\.\s*/, "").trim();
    const levelText = extractSimpleClassText(block, "div", "level");
    const level = Number(levelText.replace(/[^0-9]/g, "")) || 1;

    if (!name) continue;

    const effects: TeamColorEffect[] = [];
    const effectPattern = /<span\b[^>]*class=["'][^"']*\bitem\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi;

    for (const effectMatch of block.matchAll(effectPattern)) {
      const effect = parseEffectText(htmlToText(effectMatch[1]));
      if (effect) effects.push(effect);
    }

    if (effects.length === 0) continue;

    const key = `${normalizeName(name)}|${level}|${effects
      .map((effect) => `${effect.label}:${effect.value}`)
      .join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);

    rows.push({
      name,
      level,
      maxLevel: level,
      effects,
    });
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

  // 공식 선수 상세 페이지에서 강화 단계별로 노출되는 강화 팀컬러.
  // 3강: 동빛, 5강: 은빛, 8강: 금빛, 11강: 백금빛이 추가된다.
  if (strong >= 11) {
    add("백금빛 물결", 1, 4, 2);
    add("백금빛 물결", 2, 5, 2);
  }

  if (strong >= 8) {
    add("금빛 물결", 1, 3, 2);
    add("금빛 물결", 2, 4, 2);
  }

  if (strong >= 5) {
    add("은빛 물결", 1, 2, 2);
    add("은빛 물결", 2, 3, 2);
  }

  if (strong >= 3) {
    add("동빛 물결", 1, 1, 1);
  }

  return rows;
}

function getSectionHtml(html: string, startLabel: string, endLabels: string[]) {
  const start = html.indexOf(startLabel);
  if (start < 0) return "";

  let end = html.length;
  for (const endLabel of endLabels) {
    const candidate = html.indexOf(endLabel, start + startLabel.length);
    if (candidate >= 0 && candidate < end) end = candidate;
  }

  return html.slice(start, end);
}

function extractSelectorNamesFromSection(
  html: string,
  startLabel: string,
  endLabels: string[]
) {
  const section = getSectionHtml(html, startLabel, endLabels);
  if (!section) return [];

  const names: string[] = [];
  const seen = new Set<string>();
  const candidates: string[] = [];
  const selectorPattern = /<a\b[^>]*class=["'][^"']*\bselector_item\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of section.matchAll(selectorPattern)) {
    candidates.push(htmlToText(match[1]));
  }

  // 일부 응답은 selector_item 클래스 없이 li 텍스트만 내려온다.
  if (candidates.length === 0) {
    const liPattern = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
    for (const match of section.matchAll(liPattern)) {
      candidates.push(htmlToText(match[1]));
    }
  }

  for (const raw of candidates) {
    const name = raw.replace(/^선택\s*/, "").trim();
    if (!name) continue;

    if (
      name === startLabel ||
      name === "강화 팀컬러" ||
      name === "소속 팀컬러" ||
      name === "관계 팀컬러" ||
      name === "특성 팀컬러" ||
      name === "단일팀"
    ) {
      continue;
    }

    if (seen.has(normalizeName(name))) continue;
    seen.add(normalizeName(name));
    names.push(name);
  }

  return names;
}

async function searchTeamColors(
  query: string,
  category: TeamColorCategory
): Promise<TeamColorOption[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = new URL("https://fconline.nexon.com/datacenter/teamcolor");
  url.searchParams.set("strTeamColorCategory", "");
  url.searchParams.set(
    "strTeamColorType",
    category === "feature" ? ",relation," : ",special,club,nation,"
  );
  url.searchParams.set("strCategory", "");
  url.searchParams.set("strTeamColorName", trimmed);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
      },
      cache: "no-store",
    });

    if (!response.ok) return [];

    // 반드시 전체 검색 결과를 파싱한 뒤 정확한 이름을 고른다.
    // 먼저 60개 등으로 자르면 '레알 마드리드'보다 앞에 있는
    // '19-20 레알 마드리드' 같은 시즌 팀컬러 때문에 정확한 항목이 사라질 수 있다.
    return parseTeamColors(await response.text());
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
      const rows = await searchTeamColors(name, category);
      const exact = rows.filter(
        (row) => normalizeName(row.name) === normalizeName(name)
      );

      if (exact.length > 0) {
        return exact.map((row) => ({ ...row, category }));
      }

      // 선수 상세 페이지에 실제로 노출된 이름은 절대 버리지 않는다.
      // 효과 페이지 파싱이 일시적으로 실패해도 잘못된 다른 팀컬러로 대체하지 않는다.
      return [
        {
          name,
          level: 0,
          maxLevel: 0,
          effects: [],
          category,
        },
      ];
    })
  );

  const seen = new Set<string>();
  return groups.flat().filter((row) => {
    const key = `${normalizeName(row.name)}|${row.level}|${category}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getOfficialPlayerInfoHtml(spid: number, strong: number) {
  const url = new URL("https://fconline.nexon.com/DataCenter/PlayerInfo");
  url.searchParams.set("n1Strong", String(strong));
  url.searchParams.set("spid", String(spid));

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
    },
    cache: "no-store",
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
    // 팀컬러 후보는 전역 검색 결과가 아니라 해당 선수의 공식 PlayerInfo 페이지에서만 뽑는다.
    // 따라서 푸스카스라면 실제 선수 상세에 있는 레알 마드리드/헝가리 등만 후보가 된다.
    const playerInfoHtml = await getOfficialPlayerInfoHtml(spid, safeStrong);
    if (!playerInfoHtml) {
      return { reinforcement, affiliation: [], feature: [] };
    }

    const affiliationNames = extractSelectorNamesFromSection(
      playerInfoHtml,
      "소속 팀컬러",
      ["관계 팀컬러", "특성 팀컬러", "클래스 비교"]
    );
    const featureNames = extractSelectorNamesFromSection(
      playerInfoHtml,
      playerInfoHtml.includes("관계 팀컬러") ? "관계 팀컬러" : "특성 팀컬러",
      ["클래스 비교", "동일한 능력치 대조"]
    );

    const [affiliation, feature] = await Promise.all([
      resolveNames(affiliationNames, "affiliation"),
      resolveNames(featureNames, "feature"),
    ]);

    return { reinforcement, affiliation, feature };
  } catch (error) {
    console.error("FC Online player team color fetch failed", error);
    return { reinforcement, affiliation: [], feature: [] };
  }
}
