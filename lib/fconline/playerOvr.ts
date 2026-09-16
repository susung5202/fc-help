const POSITIONS = [
  "ST",
  "CF",
  "LW",
  "RW",
  "CM",
  "CAM",
  "CDM",
  "LM",
  "RM",
  "CB",
  "RB",
  "LB",
  "RWB",
  "LWB",
  "GK",
] as const;

const NEW_TRAITS = [
  "라인 브레이커",
  "크로스 포쳐",
  "와일드 태클러",
  "체이서",
  "아크로바틱 피니셔",
  "2개의 심장",
  "파이터",
  "GK 빠른 반응",
  "스피드스터",
  "타이탄",
  "커맨더",
  "블로커",
  "GK 공중볼 장악",
  "트릭스터",
  "레이저 슈터",
  "프레데터",
  "GK 데드아이",
] as const;

export type PlayerOvrInfo = {
  ovr: number;
  position: string;
  newTraits: string[];
};

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

function compact(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function parsePlayerInfo(html: string): PlayerOvrInfo | null {
  const text = htmlToText(html);
  const positionPattern = POSITIONS.join("|");
  const pattern = new RegExp(`(?:^|\\s)(\\d{2,3})\\s+(${positionPattern})(?=\\s|$)`, "g");

  let parsed: { ovr: number; position: string } | null = null;

  for (const match of text.matchAll(pattern)) {
    const ovr = Number(match[1]);
    if (Number.isFinite(ovr) && ovr >= 40 && ovr <= 200) {
      parsed = {
        ovr,
        position: match[2],
      };
      break;
    }
  }

  if (!parsed) return null;

  const compactText = compact(text);
  const newTraits = NEW_TRAITS.filter((trait) =>
    compactText.includes(compact(trait))
  );

  return {
    ...parsed,
    newTraits: [...newTraits],
  };
}

export async function getPlayerOvr(
  spid: number
): Promise<PlayerOvrInfo | null> {
  try {
    const response = await fetch(
      `https://m.fconline.nexon.com/datacenter/playerinfo?spid=${spid}`,
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "ko-KR,ko;q=0.9",
        },
        next: { revalidate: 86400 },
      }
    );

    if (!response.ok) {
      return null;
    }

    return parsePlayerInfo(await response.text());
  } catch {
    return null;
  }
}

export async function getPlayerOvrMap(spids: number[]) {
  const uniqueSpids = Array.from(new Set(spids));
  const entries = await Promise.all(
    uniqueSpids.map(async (spid) => [spid, await getPlayerOvr(spid)] as const)
  );

  return new Map(entries);
}
