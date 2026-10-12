import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

type HourType = "odd" | "even";

const SOURCE_URL =
  "https://www.inven.co.kr/board/fifaonline4/3146/7560874";

const ALIASES = [
  ["19챔", "19 UCL (19 UEFA Champions League)"],
  ["20챔", "20 UCL (20 UEFA Champions League)"],
  ["21챔", "21 UCL (21 UEFA Champions League)"],
  ["22챔", "22 UCL (22 UEFA Champions League)"],
  ["라이브", "22 LIVE (22 LIVE)"],
  ["18라이브", "18 LIVE (18 LIVE)"],
  ["19라이브", "19 LIVE (19 LIVE)"],
  ["12KH", "2012 KH (2012 KH)"],
  ["22PL", "22 PL (22 Premium Live)"],
  ["21PL", "21 PL (21 Premium Live)"],
  ["19A", "19 PLA (19 Premium Live Autumn)"],
  ["20A", "20 PLA (20 Premium Live)"],
  ["NHD", "NHD (National Hero Debut)"],
  ["LH", "LH (Loyal Heroes)"],
  ["TC", "TC (Tournament Champions)"],
  ["19NG", "19NG (19 NEW GENERATION)"],
  ["교육", "EBS (European Best Stars)"],
] as const;

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x27;/gi, "'");
}

function htmlToText(html: string) {
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
  return value.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&");
}

function normalizePlayerKey(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^0-9a-z가-힣]+/g, "");
}

function parsePage(text: string) {
  const aliasMap = new Map(
    ALIASES.map(([alias, seasonName]) => [
      alias.toLocaleLowerCase("ko-KR"),
      seasonName,
    ])
  );
  const aliases = ALIASES.map(([alias]) => escapeRegExp(alias))
    .sort((a, b) => b.length - a.length)
    .join("|");

  const pattern = new RegExp(
    `(${aliases})\\s*([가-힣A-Za-zÀ-ž.·'’\\- ]{1,38}?)\\s+` +
      `(홀수|짝수)\\s*시?\\s*(\\d{1,2})` +
      `(?:\\s*[~～-]\\s*(\\d{1,2}))?\\s*분`,
    "gi"
  );

  const rows: Array<{
    playerName: string;
    seasonAlias: string;
    seasonName: string;
    hourType: HourType;
    startMinute: number;
    endMinute: number;
  }> = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(pattern)) {
    const seasonAlias = match[1];
    const seasonName = aliasMap.get(
      seasonAlias.toLocaleLowerCase("ko-KR")
    );
    const playerName = match[2].replace(/\s+/g, " ").trim();
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

    const key =
      `${seasonAlias.toLocaleLowerCase("ko-KR")}:${normalizePlayerKey(playerName)}`;
    if (!normalizePlayerKey(playerName) || seen.has(key)) continue;
    seen.add(key);

    rows.push({
      playerName,
      seasonAlias,
      seasonName,
      hourType: match[3] === "홀수" ? "odd" : "even",
      startMinute,
      endMinute,
    });
  }

  return rows;
}

async function authorized(request: Request) {
  const suppliedSecret = request.headers.get("x-fc-help-cron-secret");
  if (!suppliedSecret) return false;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("cron_secrets")
    .select("secret")
    .eq("name", "push_run")
    .maybeSingle();

  return !error && data?.secret === suppliedSecret;
}

export async function GET(request: Request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(SOURCE_URL, {
      cache: "no-store",
      headers: {
        "user-agent":
          "FC-Help/1.0 (+https://fchelp.xyz) public-refresh-reference",
        accept: "text/html,application/xhtml+xml",
      },
    });
    const html = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        { error: "Inven 7560874 fetch failed", status: response.status },
        { status: 502 }
      );
    }

    const parsed = parsePage(htmlToText(html));
    const supabase = createAdminClient();

    const { data: existingData, error: existingError } = await supabase
      .from("refresh_observations")
      .select(
        "source_record_key, player_spid, player_name, season_name, observation_kind, start_hour_type, start_minute, end_hour_type, end_minute"
      )
      .eq("source_url", SOURCE_URL)
      .limit(1000);

    if (existingError) throw existingError;

    const existingSpidByKey = new Map<string, number | null>();
    const existingPatternKeys = new Set<string>();

    const patternKey = (row: {
      player_name: string;
      season_name: string;
      observation_kind: string;
      start_hour_type: string;
      start_minute: number;
      end_hour_type: string;
      end_minute: number;
    }) =>
      [
        row.player_name,
        row.season_name,
        row.observation_kind,
        row.start_hour_type,
        row.start_minute,
        row.end_hour_type,
        row.end_minute,
      ].join("::");

    for (const row of existingData ?? []) {
      if (row.source_record_key) {
        existingSpidByKey.set(
          String(row.source_record_key),
          row.player_spid === null ? null : Number(row.player_spid)
        );
      }
      existingPatternKeys.add(
        patternKey({
          player_name: String(row.player_name),
          season_name: String(row.season_name),
          observation_kind: String(row.observation_kind),
          start_hour_type: String(row.start_hour_type),
          start_minute: Number(row.start_minute),
          end_hour_type: String(row.end_hour_type),
          end_minute: Number(row.end_minute),
        })
      );
    }

    const rows = parsed.flatMap((item) => {
      const sourceRecordKey =
        `inven:7560874:${item.seasonAlias.toLocaleLowerCase("ko-KR")}:${normalizePlayerKey(
          item.playerName
        )}`;
      const observationKind =
        item.startMinute === item.endMinute ? "exact" : "range";

      const row = {
        player_spid: existingSpidByKey.get(sourceRecordKey) ?? null,
        player_name: item.playerName,
        season_name: item.seasonName,
        observation_kind: observationKind,
        start_hour_type: item.hourType,
        start_minute: item.startMinute,
        end_hour_type: item.hourType,
        end_minute: item.endMinute,
        source_type: "scraped_public" as const,
        source_name: "Inven 저중버롤 갱신시간 모음",
        source_url: SOURCE_URL,
        source_observation_count: 1,
        source_status: "estimated" as const,
        source_observed_date: "2023-03-13",
        observer_key: sourceRecordKey,
        source_record_key: sourceRecordKey,
        updated_at: new Date().toISOString(),
      };

      const key = patternKey({
        player_name: row.player_name,
        season_name: row.season_name,
        observation_kind: row.observation_kind,
        start_hour_type: row.start_hour_type,
        start_minute: row.start_minute,
        end_hour_type: row.end_hour_type,
        end_minute: row.end_minute,
      });

      if (
        !existingSpidByKey.has(sourceRecordKey) &&
        existingPatternKeys.has(key)
      ) {
        return [];
      }

      return [row];
    });

    if (rows.length > 0) {
      const { error } = await supabase
        .from("refresh_observations")
        .upsert(rows, {
          onConflict: "source_record_key",
          ignoreDuplicates: false,
        });

      if (error) throw error;
    }

    return NextResponse.json({
      success: true,
      parsed: parsed.length,
      upserted: rows.length,
      sample: parsed.slice(0, 20),
    });
  } catch (error) {
    console.error("Inven 7560874 scrape failed:", error);
    return NextResponse.json(
      {
        error: "Inven 7560874 scrape failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
