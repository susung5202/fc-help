import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

type HourType = "odd" | "even";

type ParsedObservation = {
  playerName: string;
  seasonAlias: string;
  seasonName: string;
  observationKind: "exact" | "range";
  startHourType: HourType;
  startMinute: number;
  endHourType: HourType;
  endMinute: number;
  sourceStatus: "reported" | "estimated";
};

const SOURCE_URL =
  "https://www.inven.co.kr/board/fifaonline4/3145/51542";

const SEASON_ALIASES = [
  ["DC", "DC (Decade)"],
  ["19TOTY", "19 TOTY (19 Team Of The Year)"],
  ["20TOTS", "20 TOTS (20 Team Of The Season)"],
  ["19TOTS", "19 TOTS (19 Team Of The Season)"],
  ["20UCL", "20 UCL (20 UEFA Champions League)"],
  ["MC", "MC (Multi-League Champions)"],
  ["BTB", "BTB (Back to Back)"],
  ["21KLB", "21KB (21 K-League Best)"],
  ["21KB", "21KB (21 K-League Best)"],
  ["BWC", "BWC (Best of World Cup)"],
  ["CAP", "CAP (Captain)"],
  ["SPL", "SPL (Spotlight)"],
  ["UP", "UP (Unsung Players)"],
  ["WC", "WC22 (World Cup 2022)"],
  ["EBS", "EBS (European Best Stars)"],
  ["22NG", "22NG (22 NEW GENERATION)"],
  ["LOL", "LOL (LEGEND OF THE LOAN)"],
  ["VTR", "VTR (Veteran)"],
  ["FA", "FA (FREE AGENT)"],
  ["MOG", "MOG (Moments Of Glory)"],
  ["21UCL", "21 UCL (21 UEFA Champions League)"],
  ["22UCL", "22 UCL (22 UEFA Champions League)"],
  ["K22", "22 KFA (22 KFA)"],
  ["CC", "CC (CenturyClub)"],
  ["LH", "LH (Loyal Heroes)"],
  ["HOT", "HOT (Heroes Of the Team)"],
  ["BOE", "BOE21 (Best of Europe 21)"],
  ["21TOTS", "21 TOTS (21 Team Of The Season)"],
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

function parsePage(text: string): ParsedObservation[] {
  const aliasMap = new Map(
    SEASON_ALIASES.map(([alias, seasonName]) => [
      alias.toLocaleLowerCase("ko-KR"),
      seasonName,
    ])
  );
  const aliases = SEASON_ALIASES
    .map(([alias]) => escapeRegExp(alias))
    .sort((a, b) => b.length - a.length)
    .join("|");

  const pattern = new RegExp(
    `(?:^|\\s)(${aliases})\\s+([가-힣A-Za-zÀ-ž.·'’\\- ]{1,38}?)\\s+` +
      `(홀수|짝수|홀|짝)\\s*(?:시\\s*)?(\\d{1,2})` +
      `(?:\\s*[~～-]\\s*(?:(홀수|짝수|홀|짝)\\s*)?(\\d{1,2}))?\\s*(?:분)?`,
    "gi"
  );

  const results: ParsedObservation[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(pattern)) {
    const seasonAlias = match[1];
    const seasonName = aliasMap.get(
      seasonAlias.toLocaleLowerCase("ko-KR")
    );
    const playerName = match[2].replace(/\s+/g, " ").trim();
    const startHourType: HourType =
      match[3] === "홀수" || match[3] === "홀" ? "odd" : "even";
    const startMinute = Number(match[4]);
    const endHourType: HourType = match[5]
      ? match[5] === "홀수" || match[5] === "홀"
        ? "odd"
        : "even"
      : startHourType;
    const endMinute = match[6] ? Number(match[6]) : startMinute;

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
    if (!normalizePlayerKey(playerName) || seen.has(key)) continue;
    seen.add(key);

    const nearby = text.slice(
      (match.index ?? 0) + match[0].length,
      (match.index ?? 0) + match[0].length + 18
    );
    const approximate = /쯤|근처|전|이전|초반|사이|대/.test(nearby);

    results.push({
      playerName,
      seasonAlias,
      seasonName,
      observationKind:
        startHourType === endHourType && startMinute === endMinute
          ? "exact"
          : "range",
      startHourType,
      startMinute,
      endHourType,
      endMinute,
      sourceStatus: approximate ? "estimated" : "reported",
    });
  }

  return results;
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
        { error: "Inven 51542 fetch failed", status: response.status },
        { status: 502 }
      );
    }

    const parsed = parsePage(htmlToText(html));
    const supabase = createAdminClient();

    const { data: existingData, error: existingError } = await supabase
      .from("refresh_observations")
      .select(
        "source_record_key, player_spid, player_name, season_name, observation_kind, start_hour_type, start_minute, end_hour_type, end_minute, source_url"
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
        `inven:51542:${item.seasonAlias.toLocaleLowerCase("ko-KR")}:${normalizePlayerKey(
          item.playerName
        )}`;

      const row = {
        player_spid: existingSpidByKey.get(sourceRecordKey) ?? null,
        player_name: item.playerName,
        season_name: item.seasonName,
        observation_kind: item.observationKind,
        start_hour_type: item.startHourType,
        start_minute: item.startMinute,
        end_hour_type: item.endHourType,
        end_minute: item.endMinute,
        source_type: "scraped_public" as const,
        source_name: "Inven 아는 갱신 모음",
        source_url: SOURCE_URL,
        source_observation_count: 1,
        source_status: item.sourceStatus,
        source_observed_date: "2023-10-16",
        observer_key: sourceRecordKey,
        source_record_key: sourceRecordKey,
        updated_at: new Date().toISOString(),
      };

      const existingPattern = patternKey({
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
        existingPatternKeys.has(existingPattern)
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
    console.error("Inven 51542 scrape failed:", error);
    return NextResponse.json(
      {
        error: "Inven 51542 scrape failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
