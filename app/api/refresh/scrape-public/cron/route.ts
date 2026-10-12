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
];

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
      `(확인됨|추정|제보)\\s+(\\d+)번(?:\\s*[·•]\\s*(\\d{1,2}\\.\\d{1,2}))?`,
    "g"
  );

  const results: ParsedObservation[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(rowPattern)) {
    const playerName = match[1].trim();
    const startHourType = hourType(match[2]);
    const startMinute = Number(match[3]);
    const endHourType = match[4] ? hourType(match[4]) : startHourType;
    const endMinute =
      match[5] === undefined ? startMinute : Number(match[5]);
    const rawStatus = match[6];
    const sourceObservationCount = Number(match[7]);
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
        : rawStatus === "제보"
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

    for (const source of SOURCES) {
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
      sourcePages: SOURCES.length,
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
