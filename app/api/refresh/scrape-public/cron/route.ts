import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

type HourType = "odd" | "even";

type SourceConfig = {
  slug: string;
  seasonCode: string;
  seasonName: string;
  url: string;
};

type ParsedObservation = {
  playerName: string;
  observationKind: "exact" | "range";
  startHourType: HourType;
  startMinute: number;
  endHourType: HourType;
  endMinute: number;
  sourceObservationCount: number;
  sourceStatus: "estimated" | "reported" | "confirmed";
  sourceObservedDate: string | null;
};

type ParsedBulkObservation = ParsedObservation & {
  seasonName: string;
  seasonAlias: string;
};

const INVEN_BULK_URL =
  "https://www.inven.co.kr/board/fifaonline4/3145/52273";

const INVEN_SEASON_ALIASES = [
  ["12KH", "2012 KH (2012 KH)"],
  ["CAP", "CAP (Captain)"],
  ["라이브", "23 LIVE (23 LIVE)"],
  ["20챔", "20 UCL (20 UEFA Champions League)"],
  ["21PL", "21 PL (21 Premium Live)"],
  ["TC", "TC (Tournament Champions)"],
  ["NHD", "NHD (National Hero Debut)"],
  ["EBS", "EBS (European Best Stars)"],
  ["19챔", "19 UCL (19 UEFA Champions League)"],
  ["22PL", "22 PL (22 Premium Live)"],
  ["19NG", "19NG (19 NEW GENERATION)"],
  ["BWC", "BWC (Best of World Cup)"],
  ["21KB", "21KB (21 K-League Best)"],
  ["23토티", "23 TOTY (23 Team Of The Year)"],
  ["BTB", "BTB (Back to Back)"],
  ["BOE", "BOE21 (Best of Europe 21)"],
  ["21TS", "21 TOTS (21 Team Of The Season)"],
  ["19A", "19 PLA (19 Premium Live Autumn)"],
  ["20A", "20 PLA (20 Premium Live)"],
  ["21챔", "21 UCL (21 UEFA Champions League)"],
  ["22NG", "22NG (22 NEW GENERATION)"],
  ["아이콘", "ICON (ICON)"],
  ["MOG", "MOG (Moments Of Glory)"],
  ["SPL", "SPL (Spotlight)"],
  ["WC", "WC22 (World Cup 2022)"],
  ["UP", "UP (Unsung Players)"],
  ["MC", "MC (Multi-League Champions)"],
  ["LOL", "LOL (LEGEND OF THE LOAN)"],
  ["LH", "LH (Loyal Heroes)"],
  ["VTR", "VTR (Veteran)"],
  ["24토티", "24 TOTY (24 Team Of The Year)"],
  ["FA", "FA (FREE AGENT)"],
  ["23KFA", "23 KFA (23 KFA)"],
  ["HG", "HG (Home Grown)"],
  ["22챔", "22 UCL (22 UEFA Champions League)"],
  ["23히어로즈", "23HR (23 Heroes)"],
  ["23TS", "23 TOTS (23 Team Of The Season)"],
  ["CC", "CC (CenturyClub)"],
  ["DC", "DC (Decade)"],
  ["23챔", "23 UCL (23 UEFA Champions League)"],
  ["24HR", "24HR (24 Heroes)"],
  ["LN", "LN (LEGENDARY NUMBERS)"],
  ["RTN", "RTN (Returnees)"],
] as const;

const SOURCES: SourceConfig[] = [
  {
    slug: "26fsl",
    seasonCode: "26FSL",
    seasonName: "26 FCO Superchampions League",
    url: "https://fconlab.com/refresh/seasons/26fsl",
  },
  {
    slug: "26tots",
    seasonCode: "26TOTS",
    seasonName: "26 Team Of The Season",
    url: "https://fconlab.com/refresh/seasons/26tots",
  },
  {
    slug: "25ucl",
    seasonCode: "25UCL",
    seasonName: "25 UEFA Champions League",
    url: "https://fconlab.com/refresh/seasons/25ucl",
  },
  {
    slug: "tk",
    seasonCode: "TK",
    seasonName: "Team Korea",
    url: "https://fconlab.com/refresh/seasons/tk",
  },
  {
    slug: "ptg",
    seasonCode: "PTG",
    seasonName: "Path to Glory",
    url: "https://fconlab.com/refresh/seasons/ptg",
  },
  {
    slug: "wg",
    seasonCode: "WG",
    seasonName: "Warriors of Glory",
    url: "https://fconlab.com/refresh/seasons/wg",
  },
  {
    slug: "ws",
    seasonCode: "WS",
    seasonName: "Winning Streak",
    url: "https://fconlab.com/refresh/seasons/ws",
  },
  {
    slug: "uc",
    seasonCode: "UC",
    seasonName: "Untouchable Champions",
    url: "https://fconlab.com/refresh/seasons/uc",
  },
  {
    slug: "25dp",
    seasonCode: "25DP",
    seasonName: "25 Devoted Player",
    url: "https://fconlab.com/refresh/seasons/25dp",
  },
  {
    slug: "22ucl",
    seasonCode: "22UCL",
    seasonName: "22 UEFA Champions League",
    url: "https://fconlab.com/refresh/seasons/22ucl",
  },
  {
    slug: "spt",
    seasonCode: "SPT",
    seasonName: "SPT (Spartan)",
    url: "https://fconlab.com/refresh/seasons/spt",
  },
  {
    slug: "26hr",
    seasonCode: "26HR",
    seasonName: "26HR (26 Heroes)",
    url: "https://fconlab.com/refresh/seasons/26hr",
  },
  {
    slug: "26toty",
    seasonCode: "26TOTY",
    seasonName: "26 TOTY (26 Team Of The Year)",
    url: "https://fconlab.com/refresh/seasons/26toty",
  },
  {
    slug: "25fsl",
    seasonCode: "25FSL",
    seasonName: "25FSL (25 FCO Superchampions League)",
    url: "https://fconlab.com/refresh/seasons/25fsl",
  },
  {
    slug: "25tots",
    seasonCode: "25TOTS",
    seasonName: "25 TOTS (25 Team Of The Season)",
    url: "https://fconlab.com/refresh/seasons/25tots",
  },
  {
    slug: "fac",
    seasonCode: "FAC",
    seasonName: "FAC (Football Association Champions)",
    url: "https://fconlab.com/refresh/seasons/fac",
  },
  {
    slug: "khd",
    seasonCode: "KHD",
    seasonName: "KHD (Korea Heroes Debut)",
    url: "https://fconlab.com/refresh/seasons/khd",
  },
  {
    slug: "24ucl",
    seasonCode: "24UCL",
    seasonName: "24 UCL (24 UEFA Champions League)",
    url: "https://fconlab.com/refresh/seasons/24ucl",
  },
  {
    slug: "bdo",
    seasonCode: "BDO",
    seasonName: "BDO (Ballon d'Or)",
    url: "https://fconlab.com/refresh/seasons/bdo",
  },
  {
    slug: "ch",
    seasonCode: "CH",
    seasonName: "CH (Continental Heroes)",
    url: "https://fconlab.com/refresh/seasons/ch",
  },
  {
    slug: "dcb",
    seasonCode: "DCB",
    seasonName: "DCB (Dramatic Comebacks)",
    url: "https://fconlab.com/refresh/seasons/dcb",
  },
  {
    slug: "gru",
    seasonCode: "GRU",
    seasonName: "GRU (Greatest Runner-Ups)",
    url: "https://fconlab.com/refresh/seasons/gru",
  },
  {
    slug: "le",
    seasonCode: "LE",
    seasonName: "LE (Legend of Europa)",
    url: "https://fconlab.com/refresh/seasons/le",
  },
  {
    slug: "cu",
    seasonCode: "CU",
    seasonName: "CU (Champions of Europe)",
    url: "https://fconlab.com/refresh/seasons/cu",
  },
  {
    slug: "eu24",
    seasonCode: "EU24",
    seasonName: "EU24 (UEFA EURO 2024)",
    url: "https://fconlab.com/refresh/seasons/eu24",
  },
  {
    slug: "no7",
    seasonCode: "NO7",
    seasonName: "NO7 (NUMBER 7)",
    url: "https://fconlab.com/refresh/seasons/no7",
  },
  {
    slug: "23ucl",
    seasonCode: "23UCL",
    seasonName: "23 UCL (23 UEFA Champions League)",
    url: "https://fconlab.com/refresh/seasons/23ucl",
  },
  {
    slug: "bld",
    seasonCode: "BLD",
    seasonName: "BLD (Best Legends)",
    url: "https://fconlab.com/refresh/seasons/bld",
  },
  {
    slug: "dc",
    seasonCode: "DC",
    seasonName: "DC (Decade)",
    url: "https://fconlab.com/refresh/seasons/dc",
  },
  {
    slug: "jnm",
    seasonCode: "JNM",
    seasonName: "JNM (Journeyman)",
    url: "https://fconlab.com/refresh/seasons/jnm",
  },
  {
    slug: "tb",
    seasonCode: "TB",
    seasonName: "TB (Tournament Best)",
    url: "https://fconlab.com/refresh/seasons/tb",
  },
  {
    slug: "20ucl",
    seasonCode: "20UCL",
    seasonName: "20 UCL (20 UEFA Champions League)",
    url: "https://fconlab.com/refresh/seasons/20ucl",
  },
  {
    slug: "coc",
    seasonCode: "COC",
    seasonName: "COC (Competitor Of Continents)",
    url: "https://fconlab.com/refresh/seasons/coc",
  },
  {
    slug: "fa",
    seasonCode: "FA",
    seasonName: "FA (FREE AGENT)",
    url: "https://fconlab.com/refresh/seasons/fa",
  },
  {
    slug: "mc",
    seasonCode: "MC",
    seasonName: "MC (Multi-League Champions)",
    url: "https://fconlab.com/refresh/seasons/mc",
  },
  {
    slug: "spl",
    seasonCode: "SPL",
    seasonName: "SPL (Spotlight)",
    url: "https://fconlab.com/refresh/seasons/spl",
  },
  {
    slug: "tt",
    seasonCode: "TT",
    seasonName: "TT (Top Transfer)",
    url: "https://fconlab.com/refresh/seasons/tt",
  },
  {
    slug: "21ucl",
    seasonCode: "21UCL",
    seasonName: "21 UCL (21 UEFA Champions League)",
    url: "https://fconlab.com/refresh/seasons/21ucl",
  },
  {
    slug: "icontm",
    seasonCode: "ICON TM",
    seasonName: "ICON TM (ICON The Moment)",
    url: "https://fconlab.com/refresh/seasons/icontm",
  },
  {
    slug: "icon",
    seasonCode: "ICON",
    seasonName: "ICON (ICON)",
    url: "https://fconlab.com/refresh/seasons/icon",
  },
];

// Daily refresh focuses on current/high-demand seasons. Legacy observations remain in DB.
const ACTIVE_SOURCES = SOURCES.slice(0, 15);

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/");
}

function htmlToSearchableText(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hourType(value: string): HourType {
  return value === "홀수" ? "odd" : "even";
}

function sanitizePlayerName(value: string) {
  let name = value.replace(/\s+/g, " ").trim();

  const alertMarker = "알림 받기 ";
  const alertIndex = name.lastIndexOf(alertMarker);
  if (alertIndex >= 0) {
    name = name.slice(alertIndex + alertMarker.length).trim();
  }

  const observationMarker = "상태 관측 ";
  const observationIndex = name.lastIndexOf(observationMarker);
  if (observationIndex >= 0) {
    name = name.slice(observationIndex + observationMarker.length).trim();
  }

  return name;
}

function normalizePlayerKey(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^0-9a-z가-힣]+/g, "");
}

function parseObservedDate(value: string | undefined) {
  if (!value) return null;

  const match = value.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (!match) return null;

  const year = new Date().getFullYear();
  const month = match[1].padStart(2, "0");
  const day = match[2].padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parsePage(text: string, source: SourceConfig): ParsedObservation[] {
  const positions =
    "(?:ST|CF|LW|RW|CAM|LM|RM|CM|CDM|LB|LWB|RB|RWB|CB|GK)";
  const code = escapeRegExp(source.seasonCode);

  const rowPattern = new RegExp(
    `([가-힣A-Za-zÀ-ž0-9.·'’ -]{1,60}?)\\s+${code}\\s+${positions}\\s+` +
      `(홀수|짝수)시\\s*(\\d{1,2})(?:분)?` +
      `(?:\\s*[~～-]\\s*(?:(홀수|짝수)시\\s*)?(\\d{1,2})분)?\\s+` +
      `(확인됨|추정|제보(?:\\s*기반)?)\\s+(?:(\\d+)번|제보)(?:\\s*[·•]\\s*(\\d{1,2}\\.\\d{1,2}))?`,
    "g"
  );

  const results: ParsedObservation[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(rowPattern)) {
    const playerName = sanitizePlayerName(match[1]);
    const startHourType = hourType(match[2]);
    const startMinute = Number(match[3]);
    const endHourType = match[4] ? hourType(match[4]) : startHourType;
    const endMinute =
      match[5] === undefined ? startMinute : Number(match[5]);
    const rawStatus = match[6];
    const sourceObservationCount = match[7] ? Number(match[7]) : 1;
    const sourceObservedDate = parseObservedDate(match[8]);

    if (
      !playerName ||
      playerName === "선수" ||
      !Number.isInteger(startMinute) ||
      !Number.isInteger(endMinute) ||
      startMinute < 0 ||
      startMinute > 59 ||
      endMinute < 0 ||
      endMinute > 59
    ) {
      continue;
    }

    const sourceStatus =
      rawStatus === "확인됨"
        ? "confirmed"
        : rawStatus.startsWith("제보")
          ? "reported"
          : "estimated";

    const observationKind =
      startHourType === endHourType && startMinute === endMinute
        ? "exact"
        : "range";

    const key = normalizePlayerKey(playerName);
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      playerName,
      observationKind,
      startHourType,
      startMinute,
      endHourType,
      endMinute,
      sourceObservationCount,
      sourceStatus,
      sourceObservedDate,
    });
  }

  return results;
}

function parseInvenBulkPage(text: string): ParsedBulkObservation[] {
  const aliasMap = new Map(
    INVEN_SEASON_ALIASES.map(([alias, seasonName]) => [
      alias.toLocaleLowerCase("ko-KR"),
      seasonName,
    ])
  );
  const aliases = INVEN_SEASON_ALIASES
    .map(([alias]) => escapeRegExp(alias))
    .sort((a, b) => b.length - a.length)
    .join("|");

  const pattern = new RegExp(
    `(${aliases})\\s+([가-힣A-Za-z.· ]{1,30}?)\\s+` +
      `(홀수|짝수|홀|짝)\\s*(\\d{1,2})` +
      `(?:\\s*~\\s*(\\d{1,2}))?\\s*(분)?`,
    "gi"
  );

  const results: ParsedBulkObservation[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(pattern)) {
    const trailing = text.slice(
      (match.index ?? 0) + match[0].length,
      (match.index ?? 0) + match[0].length + 20
    );

    // "29분보다 빠름"처럼 정확한 시각이 아닌 표현은 exact로 오인하지 않는다.
    if (/보다\s*빠름/.test(trailing)) continue;

    const seasonAlias = match[1];
    const seasonName = aliasMap.get(
      seasonAlias.toLocaleLowerCase("ko-KR")
    );
    const playerName = sanitizePlayerName(match[2]);
    const startHourType: HourType =
      match[3] === "홀수" || match[3] === "홀" ? "odd" : "even";
    const startMinute = Number(match[4]);
    const endMinute = match[5] ? Number(match[5]) : startMinute;

    if (
      !seasonName ||
      !playerName ||
      !Number.isInteger(startMinute) ||
      !Number.isInteger(endMinute) ||
      startMinute < 0 ||
      startMinute > 59 ||
      endMinute < 0 ||
      endMinute > 59
    ) {
      continue;
    }

    const key = `${seasonAlias.toLocaleLowerCase("ko-KR")}:${normalizePlayerKey(
      playerName
    )}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const nearbyText = text.slice(
      (match.index ?? 0) + match[0].length,
      (match.index ?? 0) + match[0].length + 12
    );
    const isApproximate =
      !match[6] || /전|근처|사이|초반|이전|뒤/.test(nearbyText);

    results.push({
      playerName,
      seasonName,
      seasonAlias,
      observationKind: startMinute === endMinute ? "exact" : "range",
      startHourType,
      startMinute,
      endHourType: startHourType,
      endMinute,
      sourceObservationCount: 1,
      sourceStatus: isApproximate ? "estimated" : "reported",
      sourceObservedDate: "2024-01-31",
    });
  }

  return results;
}

async function checkCronSecret(request: Request) {
  const suppliedSecret = request.headers.get("x-fc-help-cron-secret");

  if (!suppliedSecret) {
    return { ok: false as const, secret: "" };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("cron_secrets")
    .select("secret")
    .eq("name", "push_run")
    .maybeSingle();

  if (error || !data?.secret || data.secret !== suppliedSecret) {
    return { ok: false as const, secret: "" };
  }

  return { ok: true as const, secret: suppliedSecret };
}

export async function GET(request: Request) {
  const auth = await checkCronSecret(request);

  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    const { data: existingData, error: existingError } = await supabase
      .from("refresh_observations")
      .select("source_record_key, player_spid")
      .eq("source_type", "scraped_public")
      .not("source_record_key", "is", null)
      .limit(5000);

    if (existingError) throw existingError;

    const existingSpidByKey = new Map<string, number | null>();
    for (const row of existingData ?? []) {
      existingSpidByKey.set(
        String(row.source_record_key),
        row.player_spid === null ? null : Number(row.player_spid)
      );
    }

    let totalParsed = 0;
    let totalUpserted = 0;

    const pages: Array<{
      slug: string;
      status: number;
      htmlLength: number;
      parsed: number;
      sample: string[];
    }> = [];

    for (const source of ACTIVE_SOURCES) {
      const response = await fetch(source.url, {
        cache: "no-store",
        headers: {
          "user-agent": "FC-Help/1.0 (+https://fchelp.xyz) public-refresh-reference",
          accept: "text/html,application/xhtml+xml",
        },
      });

      const html = await response.text();

      if (!response.ok) {
        pages.push({
          slug: source.slug,
          status: response.status,
          htmlLength: html.length,
          parsed: 0,
          sample: [],
        });
        continue;
      }

      const text = htmlToSearchableText(html);
      const parsed = parsePage(text, source);
      totalParsed += parsed.length;

      const rows = parsed.map((item) => {
        const sourceRecordKey = `fconlab:${source.slug}:${normalizePlayerKey(
          item.playerName
        )}`;

        return {
          player_spid: existingSpidByKey.get(sourceRecordKey) ?? null,
          player_name: item.playerName,
          season_name: source.seasonName,
          observation_kind: item.observationKind,
          start_hour_type: item.startHourType,
          start_minute: item.startMinute,
          end_hour_type: item.endHourType,
          end_minute: item.endMinute,
          source_type: "scraped_public",
          source_name: "피온랩 공개 시즌 관측",
          source_url: source.url,
          source_observation_count: item.sourceObservationCount,
          source_status: item.sourceStatus,
          source_observed_date: item.sourceObservedDate,
          observer_key: sourceRecordKey,
          source_record_key: sourceRecordKey,
          updated_at: new Date().toISOString(),
        };
      });

      if (rows.length > 0) {
        const { error, count } = await supabase
          .from("refresh_observations")
          .upsert(rows, {
            onConflict: "source_record_key",
            ignoreDuplicates: false,
            count: "exact",
          });

        if (error) throw error;
        totalUpserted += count ?? rows.length;
      }

      pages.push({
        slug: source.slug,
        status: response.status,
        htmlLength: html.length,
        parsed: parsed.length,
        sample: parsed.slice(0, 4).map((item) => item.playerName),
      });
    }

    const invenResponse = await fetch(INVEN_BULK_URL, {
      cache: "no-store",
      headers: {
        "user-agent":
          "FC-Help/1.0 (+https://fchelp.xyz) public-refresh-reference",
        accept: "text/html,application/xhtml+xml",
      },
    });

    const invenHtml = await invenResponse.text();
    if (invenResponse.ok) {
      const invenText = htmlToSearchableText(invenHtml);
      const parsedBulk = parseInvenBulkPage(invenText);
      totalParsed += parsedBulk.length;

      const rows = parsedBulk.map((item) => {
        const sourceRecordKey =
          `inven:52273:${item.seasonAlias.toLocaleLowerCase("ko-KR")}:${normalizePlayerKey(
            item.playerName
          )}`;

        return {
          player_spid: existingSpidByKey.get(sourceRecordKey) ?? null,
          player_name: item.playerName,
          season_name: item.seasonName,
          observation_kind: item.observationKind,
          start_hour_type: item.startHourType,
          start_minute: item.startMinute,
          end_hour_type: item.endHourType,
          end_minute: item.endMinute,
          source_type: "scraped_public",
          source_name: "Inven 갱신시간 공개 정리",
          source_url: INVEN_BULK_URL,
          source_observation_count: item.sourceObservationCount,
          source_status: item.sourceStatus,
          source_observed_date: item.sourceObservedDate,
          observer_key: sourceRecordKey,
          source_record_key: sourceRecordKey,
          updated_at: new Date().toISOString(),
        };
      });

      if (rows.length > 0) {
        const { error, count } = await supabase
          .from("refresh_observations")
          .upsert(rows, {
            onConflict: "source_record_key",
            ignoreDuplicates: false,
            count: "exact",
          });

        if (error) throw error;
        totalUpserted += count ?? rows.length;
      }

      pages.push({
        slug: "inven-52273",
        status: invenResponse.status,
        htmlLength: invenHtml.length,
        parsed: parsedBulk.length,
        sample: parsedBulk.slice(0, 4).map((item) => item.playerName),
      });
    } else {
      pages.push({
        slug: "inven-52273",
        status: invenResponse.status,
        htmlLength: invenHtml.length,
        parsed: 0,
        sample: [],
      });
    }

    const mapperUrl = new URL(
      "/api/refresh/map-observations/cron",
      request.url
    );

    const mapperResponse = await fetch(mapperUrl, {
      method: "GET",
      headers: {
        "x-fc-help-cron-secret": auth.secret,
      },
      cache: "no-store",
    });

    let mapping: unknown = null;
    try {
      mapping = await mapperResponse.json();
    } catch {
      mapping = { status: mapperResponse.status };
    }

    return NextResponse.json({
      success: true,
      sourcePages: ACTIVE_SOURCES.length,
      totalParsed,
      totalUpserted,
      pages,
      mapping,
    });
  } catch (error) {
    console.error("Public refresh scrape failed:", error);

    return NextResponse.json(
      { error: "Public refresh scrape failed" },
      { status: 500 }
    );
  }
}
