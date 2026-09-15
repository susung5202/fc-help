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
      .replace(/<(br|\/p|\/div|\/li|\/tr|\/td|\/th|\/section|\/article|\/h\d)>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim();
}

function extractNumber(text: string, label: string) {
  const pattern = new RegExp(
    `${escapeRegExp(label)}\\s*([0-9]{1,3})(?![0-9])`,
    "i"
  );
  const match = text.match(pattern);

  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

export async function getPlayerStats(
  spid: number,
  strong: number
): Promise<PlayerStatsData | null> {
  const safeStrong = Math.min(13, Math.max(1, Math.trunc(strong)));
  const sourceUrl = `https://fconline.nexon.com/DataCenter/PlayerInfo?n1Strong=${safeStrong}&spid=${spid}`;

  try {
    const response = await fetch(sourceUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
      },
      next: {
        revalidate: 3600,
      },
    });

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const text = htmlToText(html);
    const totalAbilityIndex = text.indexOf("총 능력치");

    if (totalAbilityIndex < 0) {
      return null;
    }

    const summarySection = text.slice(0, totalAbilityIndex);
    const detailSection = text.slice(totalAbilityIndex);

    const abilities: PlayerAbilityStat[] = [];

    for (const group of ABILITY_GROUPS) {
      for (const label of group.labels) {
        const value = extractNumber(detailSection, label);

        if (value !== null) {
          abilities.push({
            label,
            value,
            group: group.group,
          });
        }
      }
    }

    // 데이터센터 HTML 구조가 변경된 경우 잘못된 빈 화면을 보여주지 않는다.
    if (abilities.length < 20) {
      return null;
    }

    return {
      strong: safeStrong,
      sourceUrl,
      summary: {
        speed: extractNumber(summarySection, "스피드"),
        shooting: extractNumber(summarySection, "슛"),
        passing: extractNumber(summarySection, "패스"),
        dribbling: extractNumber(summarySection, "드리블"),
        defending: extractNumber(summarySection, "수비"),
        physical: extractNumber(summarySection, "피지컬"),
      },
      abilities,
    };
  } catch {
    return null;
  }
}
