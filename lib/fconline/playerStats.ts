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

  const parsed = new Map<string, PlayerAbilityStat>();
  const liPattern =
    /<li\b[^>]*class=["'][^"']*\bab\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;

  for (const match of html.matchAll(liPattern)) {
    const block = match[1];
    const rawLabel = extractClassText(block, "txt");
    const rawValue = extractClassText(block, "value");

    if (!rawLabel || !rawValue) continue;

    const definition = canonical.get(normalizeLabel(rawLabel));
    const numberMatch = rawValue.match(/-?\d{1,3}/);
    if (!definition || !numberMatch) continue;

    // PlayerAbility 응답에 비교용/복제 마크업이 섞여도 화면에 먼저 등장하는
    // 실제 선수 능력치를 유지한다. 뒤쪽 값으로 덮어쓰지 않는다.
    if (parsed.has(definition.label)) continue;

    const value = Number(numberMatch[0]);
    if (!Number.isFinite(value)) continue;

    parsed.set(definition.label, {
      label: definition.label,
      value,
      group: definition.group,
    });
  }

  return ABILITY_GROUPS.flatMap((group) =>
    group.labels
      .map((label) => parsed.get(label))
      .filter((stat): stat is PlayerAbilityStat => Boolean(stat))
  );
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

  // FC 온라인 데이터센터는 적응도 1 = 0, 적응도 5 = 4 증가치로 요청한다.
  const growParam = safeGrow === 5 ? 4 : 0;

  const sourceUrl = new URL(
    "https://fconline.nexon.com/DataCenter/PlayerInfo"
  );
  sourceUrl.searchParams.set("n1Strong", String(safeStrong));
  sourceUrl.searchParams.set("n1grow", String(growParam));
  sourceUrl.searchParams.set("spid", String(spid));

  try {
    // 세부 능력치는 PlayerInfo GET 페이지가 아니라 데이터센터가 실제로
    // 능력치 변경 시 호출하는 PlayerAbility POST 응답을 기준으로 읽는다.
    const html = await fetchOfficialPlayerAbility(
      spid,
      safeStrong,
      growParam,
      sourceUrl.toString()
    );
    const abilities = parseAbilities(html);

    // 필드 선수 기준 30개 이상이 정상 응답이다. 일부 항목이 누락됐다고
    // 전부 실패시키지 않되, 엉뚱한 HTML을 능력치로 표시하지는 않는다.
    if (abilities.length < 30) {
      console.error(
        "FC Online PlayerAbility parse failed",
        { spid, strong: safeStrong, grow: safeGrow, count: abilities.length }
      );
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
