export type TeamColorEffect = {
  label: string;
  value: number;
};

export type TeamColorOption = {
  name: string;
  maxLevel: number;
  level: number;
  effects: TeamColorEffect[];
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

  // 공식 데이터센터 결과는 "최고 단계 숫자 → 팀컬러명 → N단계 → 적용 효과" 순서다.
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

    rows.push({
      name,
      maxLevel,
      level,
      effects,
    });
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
