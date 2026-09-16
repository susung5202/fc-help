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

export type PlayerOvrInfo = {
  ovr: number;
  position: string;
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

function parseOvr(html: string): PlayerOvrInfo | null {
  const text = htmlToText(html);
  const positionPattern = POSITIONS.join("|");
  const pattern = new RegExp(`(?:^|\\s)(\\d{2,3})\\s+(${positionPattern})(?=\\s|$)`, "g");

  for (const match of text.matchAll(pattern)) {
    const ovr = Number(match[1]);
    if (Number.isFinite(ovr) && ovr >= 40 && ovr <= 200) {
      return {
        ovr,
        position: match[2],
      };
    }
  }

  return null;
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

    return parseOvr(await response.text());
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
