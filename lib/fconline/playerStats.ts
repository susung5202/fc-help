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

function getAbilityScope(html: string) {
  // PlayerInfo/PlayerAbility 응답 안에는 비교용 마크업이 함께 섞일 수 있다.
  // 실제 선수의 첫 번째 상세 능력치 목록만 파싱해 다른 숫자가 덮어쓰는 일을 막는다.
  const match = html.match(
    /<ul\b[^>]*class=["'][^"']*\bdata_wrap_playerinfo\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i
  );
  return match?.[1] ?? html;
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
  const scope = getAbilityScope(html);
  const liPattern = /<li\b[^>]*class=["'][^"']*\bab\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;

  for (const match of scope.matchAll(liPattern)) {
    const block = match[1];
    const rawLabel = extractClassText(block, "txt");
    const rawValue = extractClassText(block, "value");

    if (!rawLabel || !rawValue) continue;

    const definition = canonical.get(normalizeLabel(rawLabel));
    const numberMatch = rawValue.match(/-?\d{1,3}/);

    if (!definition || !numberMatch) continue;

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

async function fetchOfficialPlayerInfo(sourceUrl: string) {
  const response = await fetch(sourceUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
    },
    cache: "no-store",
  });

  return response.ok ? response.text() : "";
}

async function fetchOfficialPlayerAbility(
  spid: number,
  safeStrong: number,
  growParam: number,
  sourceUrl: string
) {
  const body = new URLSearchParams({
    spid: String(spid),
    n1Strong: String(safeStrong),
    n1Grow: String(growParam),
    n4TeamColorId: "0",
    n4TeamColorLv: "0",
    n1Change: "0",
    strPlayerImg: `https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/playersAction/p${spid}.png`,
    rd: `${safeStrong}-${growParam}`,
  });

  const response = await fetch(
    "https://fconline.nexon.com/datacenter/PlayerAbility",
    {
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
      cache: "no-store",
    }
  );

  return response.ok ? response.text() : "";
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
    // 1순위: 사용자가 공식 데이터센터에서 보는 PlayerInfo 자체를 파싱한다.
    // 이 값이 화면의 강화/적응도 선택과 가장 직접적으로 일치한다.
    const pageHtml = await fetchOfficialPlayerInfo(sourceUrl.toString());
    let abilities = parseAbilities(pageHtml);

    // PlayerInfo가 봇 차단/부분 응답을 주는 경우에만 동일한 공식 PlayerAbility로 폴백한다.
    if (abilities.length < 20) {
      const abilityHtml = await fetchOfficialPlayerAbility(
        spid,
        safeStrong,
        growParam,
        sourceUrl.toString()
      );
      abilities = parseAbilities(abilityHtml);
    }

    if (abilities.length < 20) return null;

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
