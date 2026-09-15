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

  // 알려진 능력치는 앱의 표기와 맞추되, 공식 응답에 새 능력치가 추가되면
  // 그 이름도 그대로 보여준다.
  const canonical = EFFECT_LABELS.find(
    (candidate) => candidate.replace(/\s+/g, "") === label.replace(/\s+/g, "")
  );

  return { label: canonical ?? label, value };
}

type TeamColorCandidate = {
  id: number;
  name: string;
  level: number | null;
};

type TeamColorCandidates = {
  reinforcement: TeamColorCandidate[];
  affiliation: TeamColorCandidate[];
  feature: TeamColorCandidate[];
};

function extractCandidatesFromSelector(
  html: string,
  wrapperClass: "en_wrap" | "tdefault_wrap" | "tspecial_wrap",
  hasLevel: boolean,
  sectionLabel: string
) {
  const wrapper =
    extractDivBlocksByClass(html, wrapperClass).find((block) =>
      htmlToText(block).includes(sectionLabel)
    ) ?? "";
  const candidates: TeamColorCandidate[] = [];
  const seen = new Set<string>();
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;

  for (const match of wrapper.matchAll(anchorPattern)) {
    const attributes = match[1];
    if (!hasClass(`<a ${attributes}>`, "selector_item")) continue;

    const id = Number(attributes.match(/\bdata-no\s*=\s*["'](\d+)["']/i)?.[1]);
    if (!Number.isInteger(id) || id <= 0) continue;

    const rawName = htmlToText(match[2]);
    const levelMatch = rawName.match(/^Lv\.\s*(\d+)\s+(.+)$/i);
    const level = hasLevel && levelMatch ? Number(levelMatch[1]) : null;
    const name = (levelMatch?.[2] ?? rawName).trim();
    if (!name || (hasLevel && level === null)) continue;

    const key = `${id}|${level ?? "max"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ id, name, level });
  }

  return candidates;
}

function parsePlayerAbilityTeamColors(html: string): TeamColorCandidates {
  // PlayerInfo GET은 이 영역을 빈 컨테이너로만 내려준다. 공식 화면이 실제로
  // 호출하는 PlayerAbility POST 응답의 세 selector를 각각 읽어야 한다.
  return {
    reinforcement: extractCandidatesFromSelector(
      html,
      "en_wrap",
      true,
      "강화 팀컬러"
    ),
    affiliation: extractCandidatesFromSelector(
      html,
      "tdefault_wrap",
      false,
      "소속 팀컬러"
    ),
    feature: extractCandidatesFromSelector(
      html,
      "tspecial_wrap",
      false,
      "관계 팀컬러"
    ),
  };
}

function parseTeamColorDetail(html: string) {
  const rows: Array<{ level: number; effects: TeamColorEffect[] }> = [];

  for (const block of extractDivBlocksByClass(html, "level")) {
    const levelText = extractSimpleClassText(block, "div", "tit");
    const level = Number(levelText.match(/\d+/)?.[0]);
    if (!Number.isInteger(level) || level <= 0) continue;

    const effects: TeamColorEffect[] = [];
    const liPattern = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
    for (const match of block.matchAll(liPattern)) {
      const effect = parseEffectText(htmlToText(match[1]));
      if (effect) effects.push(effect);
    }

    if (effects.length > 0) rows.push({ level, effects });
  }

  return rows;
}

async function getPlayerAbilityHtml(spid: number, strong: number) {
  const sourceUrl = `https://fconline.nexon.com/DataCenter/PlayerInfo?n1Strong=${strong}&spid=${spid}`;
  const body = new URLSearchParams({
    spid: String(spid),
    n1Strong: String(strong),
    n1Grow: "0",
    n4TeamColorId: "0",
    n4TeamColorLv: "0",
    n4TeamColorId_Enhance: "0",
    n4TeamColorLv_Enhance: "0",
    n4TeamColorId_Feature: "0",
    n1Change: "0",
    strPlayerImg: `https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/playersAction/p${spid}.png`,
    rd: "0",
  });

  const response = await fetch(
    "https://fconline.nexon.com/datacenter/PlayerAbility",
    {
      method: "POST",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        Accept: "text/html, */*; q=0.01",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Referer: sourceUrl,
        Origin: "https://fconline.nexon.com",
      },
      body,
      cache: "no-store",
    }
  );

  return response.ok ? response.text() : "";
}

async function getTeamColorDetail(teamColorId: number) {
  const url = new URL(
    "https://fconline.nexon.com/datacenter/TeamColorDetail"
  );
  url.searchParams.set("teamcolorid", String(teamColorId));

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
      Accept: "text/html, */*; q=0.01",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
      "X-Requested-With": "XMLHttpRequest",
      Referer: "https://fconline.nexon.com/datacenter/teamcolor",
    },
    cache: "no-store",
  });

  return response.ok ? parseTeamColorDetail(await response.text()) : [];
}

async function resolveCandidates(
  candidates: TeamColorCandidate[],
  category: TeamColorCategory,
  detailsById: Map<number, Promise<ReturnType<typeof parseTeamColorDetail>>>
) {
  const resolved = await Promise.all(
    candidates.map(async (candidate): Promise<TeamColorOption | null> => {
      let detail = detailsById.get(candidate.id);
      if (!detail) {
        detail = getTeamColorDetail(candidate.id);
        detailsById.set(candidate.id, detail);
      }

      const rows = await detail;
      const maxLevel = Math.max(0, ...rows.map((row) => row.level));
      const row = candidate.level
        ? rows.find((item) => item.level === candidate.level)
        : rows.find((item) => item.level === maxLevel);

      // 검색 결과나 이름 유사도 fallback은 사용하지 않는다. PlayerAbility가
      // 준 ID의 공식 상세 효과까지 확인된 후보만 화면에 노출한다.
      if (!row) return null;

      return {
        name: candidate.name,
        level: row.level,
        maxLevel,
        effects: row.effects,
        category,
      };
    })
  );

  return resolved.filter((row): row is TeamColorOption => row !== null);
}

export async function getPlayerTeamColors(
  spid: number,
  strong: number
): Promise<PlayerTeamColors> {
  const safeStrong = Math.min(13, Math.max(1, Math.trunc(strong)));

  try {
    const abilityHtml = await getPlayerAbilityHtml(spid, safeStrong);
    if (!abilityHtml) {
      return { reinforcement: [], affiliation: [], feature: [] };
    }

    const candidates = parsePlayerAbilityTeamColors(abilityHtml);
    const detailsById = new Map<
      number,
      Promise<ReturnType<typeof parseTeamColorDetail>>
    >();
    const [reinforcement, affiliation, feature] = await Promise.all([
      resolveCandidates(candidates.reinforcement, "reinforcement", detailsById),
      resolveCandidates(candidates.affiliation, "affiliation", detailsById),
      resolveCandidates(candidates.feature, "feature", detailsById),
    ]);

    return { reinforcement, affiliation, feature };
  } catch (error) {
    console.error("FC Online player team color fetch failed", error);
    return { reinforcement: [], affiliation: [], feature: [] };
  }
}
