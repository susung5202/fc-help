export type PlayerStatGroup =
  | "공격"
  | "패스"
  | "드리블"
  | "수비"
  | "피지컬"
  | "골키퍼";

export type PlayerAbilityStat = {
  label: string;
  value: number;
  group: PlayerStatGroup;
};

export type PlayerStatsData = {
  strong: number;
  grow: 1 | 5;
  sourceUrl: string;
  summary: {
    speed: number | null;
    shooting: number | null;
    passing: number | null;
    dribbling: number | null;
    defending: number | null;
    physical: number | null;
  };
  abilities: PlayerAbilityStat[];
};

const ABILITY_GROUPS: Array<{
  group: PlayerStatGroup;
  labels: string[];
}> = [
  {
    group: "공격",
    labels: [
      "골 결정력",
      "슛 파워",
      "중거리 슛",
      "위치 선정",
      "발리슛",
      "페널티 킥",
    ],
  },
  {
    group: "패스",
    labels: [
      "짧은 패스",
      "시야",
      "크로스",
      "긴 패스",
      "프리킥",
      "커브",
    ],
  },
  {
    group: "드리블",
    labels: [
      "드리블",
      "볼 컨트롤",
      "민첩성",
      "밸런스",
      "반응 속도",
    ],
  },
  {
    group: "수비",
    labels: [
      "대인 수비",
      "태클",
      "가로채기",
      "헤더",
      "슬라이딩 태클",
    ],
  },
  {
    group: "피지컬",
    labels: [
      "속력",
      "가속력",
      "몸싸움",
      "스태미너",
      "적극성",
      "점프",
      "침착성",
    ],
  },
  {
    group: "골키퍼",
    labels: [
      "GK 다이빙",
      "GK 핸들링",
      "GK 킥",
      "GK 반응속도",
      "GK 위치 선정",
    ],
  },
];

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

function normalizeLabel(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

function extractClassText(html: string, className: string) {
  const pattern = new RegExp(
    `<(?:div|span)\\b[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/(?:div|span)>`,
    "i"
  );
  const match = html.match(pattern);
  return match ? htmlToText(match[1]) : null;
}

function parseAbilities(html: string): PlayerAbilityStat[] {
  const canonical = new Map<
    string,
    { label: string; group: PlayerStatGroup }
  >();

  for (const group of ABILITY_GROUPS) {
    for (const label of group.labels) {
      canonical.set(normalizeLabel(label), {
        label,
        group: group.group,
      });
    }
  }

  const ordered: PlayerAbilityStat[] = [];
  const seen = new Set<string>();
  const detailSections: string[] = [];
  const detailSectionPattern =
    /<ul\b[^>]*class=["'][^"']*\bdata_wrap_playerinfo\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/gi;

  for (const sectionMatch of html.matchAll(detailSectionPattern)) {
    detailSections.push(sectionMatch[1]);
  }

  const detailHtml = detailSections.join("\n");
  const liPattern =
    /<li\b[^>]*class=["'][^"']*\bab\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;

  // FC 온라인 PlayerAbility의 실제 상세 능력치 등장 순서를 그대로 보존한다.
  // 앱에서 공격/패스/수비 등의 임의 그룹 순서로 재배열하지 않는다.
  for (const match of detailHtml.matchAll(liPattern)) {
    const block = match[1];
    const rawLabel = extractClassText(block, "txt");
    const rawValue = extractClassText(block, "value");

    if (!rawLabel || !rawValue) continue;

    const definition = canonical.get(normalizeLabel(rawLabel));
    const numberMatch = rawValue.match(/-?\d{1,3}/);
    if (!definition || !numberMatch || seen.has(definition.label)) continue;

    const value = Number(numberMatch[0]);
    if (!Number.isFinite(value)) continue;

    seen.add(definition.label);
    ordered.push({
      label: definition.label,
      value,
      group: definition.group,
    });
  }

  return ordered;
}

async function fetchOfficialPlayerAbility(
  spid: number,
  strong: number,
  growParam: number,
  sourceUrl: string
) {
  const body = new URLSearchParams({
    spid: String(spid),
    n1Strong: String(strong),
    n1Grow: String(growParam),
    n4TeamColorId: "0",
    n4TeamColorLv: "0",
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
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
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

  if (!response.ok) {
    console.error("FC Online PlayerAbility HTTP error", response.status);
    return "";
  }

  return response.text();
}

export async function getPlayerStats(
  spid: number,
  strong: number,
  grow: number = 1
): Promise<PlayerStatsData | null> {
  const safeStrong = Math.min(13, Math.max(1, Math.trunc(strong)));
  const safeGrow: 1 | 5 = grow === 5 ? 5 : 1;
  const growParam = safeGrow === 5 ? 4 : 0;

  const sourceUrl = new URL(
    "https://fconline.nexon.com/DataCenter/PlayerInfo"
  );
  sourceUrl.searchParams.set("n1Strong", String(safeStrong));
  sourceUrl.searchParams.set("n1grow", String(growParam));
  sourceUrl.searchParams.set("spid", String(spid));

  try {
    const html = await fetchOfficialPlayerAbility(
      spid,
      safeStrong,
      growParam,
      sourceUrl.toString()
    );
    const abilities = parseAbilities(html);

    if (abilities.length < 30) {
      console.error("FC Online PlayerAbility parse failed", {
        spid,
        strong: safeStrong,
        grow: safeGrow,
        count: abilities.length,
      });
      return null;
    }

    return {
      strong: safeStrong,
      grow: safeGrow,
      sourceUrl: sourceUrl.toString(),
      summary: {
        speed: null,
        shooting: null,
        passing: null,
        dribbling: null,
        defending: null,
        physical: null,
      },
      abilities,
    };
  } catch (error) {
    console.error("FC Online player stat fetch failed", error);
    return null;
  }
}
