import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

type HourType = "odd" | "even";

type LegacyObservation = {
  playerName: string;
  seasonAlias: string;
  seasonName: string;
  observationKind: "exact" | "range";
  startHourType: HourType;
  startMinute: number;
  endHourType: HourType;
  endMinute: number;
};

const SOURCE_URL =
  "https://www.inven.co.kr/board/fifaonline4/3145/41287";

const SEASONS = [
  ["LH", "LH (Loyal Heroes)"],
  ["TKL", "TKL (TEAM K LEAGUE)"],
  ["20KL", "20KLeague (20KLeague)"],
  ["19S", "19 PLS (19 Premium Live Spring)"],
  ["19UCL", "19 UCL (19 UEFA Champions League)"],
  ["HOT", "HOT (Heroes Of the Team)"],
  ["NG", "19NG (19 NEW GENERATION)"],
  ["TC", "TC (Tournament Champions)"],
  ["GR", "GR (Golden Rookies)"],
  ["TT", "TT (Top Transfer)"],
  ["TB", "TB (Tournament Best)"],
  ["NHD", "NHD (National Hero Debut)"],
  ["19라이브", "19 LIVE (19 LIVE)"],
  ["20TOTS", "20 TOTS (20 Team Of The Season)"],
  ["20TOTY", "20 TOTY (20 Team Of The Year)"],
  ["20TY-N", "20 TOTY-N (20 Team Of The Nominated)"],
  ["19TOTY", "19 TOTY (19 Team Of The Year)"],
  ["19TOTS", "19 TOTS (19 Team Of The Season)"],
  ["ICON", "ICON (ICON)"],
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

function parseLegacyPage(text: string): LegacyObservation[] {
  const seasonMap = new Map(
    SEASONS.map(([alias, seasonName]) => [alias.toUpperCase(), seasonName])
  );
  const aliases = SEASONS.map(([alias]) => escapeRegExp(alias))
    .sort((a, b) => b.length - a.length)
    .join("|");

  const sectionPattern = new RegExp(
    `\\[(${aliases})\\]([\\s\\S]*?)(?=\\[[^\\]]+\\]|$)`,
    "gi"
  );

  const parsed: LegacyObservation[] = [];
  const counts = new Map<string, number>();

  for (const section of text.matchAll(sectionPattern)) {
    const seasonAlias = section[1].toUpperCase();
    const seasonName = seasonMap.get(seasonAlias);
    if (!seasonName) continue;

    const sectionText = section[2]
      .replace(/\s+\d{1,2}(?:\s*~\s*\d{1,2})?초/gi, " ")
      .replace(/\s+/g, " ");

    const rowPattern =
      /([가-힣A-Za-zÀ-ž.·\- ]{1,30}?)\s+(홀수|짝수|찍수)\s*(\d{1,2})(?:\s*[~\-]\s*(\d{1,2}))?분/gi;

    for (const match of sectionText.matchAll(rowPattern)) {
      const playerName = match[1].replace(/\s+/g, " ").trim();
      const startMinute = Number(match[3]);
      const endMinute = match[4] ? Number(match[4]) : startMinute;

      if (
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

      const key = `${seasonAlias}:${normalizePlayerKey(playerName)}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);

      const startHourType: HourType =
        match[2] === "홀수" ? "odd" : "even";

      parsed.push({
        playerName,
        seasonAlias,
        seasonName,
        observationKind:
          startMinute === endMinute ? "exact" : "range",
        startHourType,
        startMinute,
        endHourType: startHourType,
        endMinute,
      });
    }
  }

  return parsed.filter(
    (row) =>
      counts.get(
        `${row.seasonAlias}:${normalizePlayerKey(row.playerName)}`
      ) === 1
  );
}

async function checkCronSecret(request: Request) {
  const suppliedSecret = request.headers.get("x-fc-help-cron-secret");
  if (!suppliedSecret) return { ok: false as const, secret: "" };

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
    const response = await fetch(SOURCE_URL, {
      cache: "no-store",
      headers: {
        "user-agent":
          "FC-Help/1.0 (+https://fchelp.xyz) legacy-refresh-reference",
        accept: "text/html,application/xhtml+xml",
      },
    });

    const html = await response.text();
    if (!response.ok) {
      return NextResponse.json(
        { error: "Legacy source fetch failed", status: response.status },
        { status: 502 }
      );
    }

    const parsed = parseLegacyPage(htmlToText(html));
    const supabase = createAdminClient();

    const { data: existingData, error: existingError } = await supabase
      .from("refresh_observations")
      .select("source_record_key, player_spid")
      .eq("source_url", SOURCE_URL)
      .not("source_record_key", "is", null)
      .limit(3000);

    if (existingError) throw existingError;

    const existingSpidByKey = new Map<string, number | null>();
    for (const row of existingData ?? []) {
      existingSpidByKey.set(
        String(row.source_record_key),
        row.player_spid === null ? null : Number(row.player_spid)
      );
    }

    const rows = parsed.map((item) => {
      const sourceRecordKey =
        `inven:41287:${item.seasonAlias.toLocaleLowerCase("ko-KR")}:${normalizePlayerKey(
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
        source_name: "Inven 2020 갱신시간 대형 정리",
        source_url: SOURCE_URL,
        source_observation_count: 1,
        source_status: "estimated",
        source_observed_date: "2020-08-12",
        observer_key: sourceRecordKey,
        source_record_key: sourceRecordKey,
        updated_at: new Date().toISOString(),
      };
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

    const mapperUrl = new URL(
      "/api/refresh/map-observations/cron",
      request.url
    );

    const mapperResponse = await fetch(mapperUrl, {
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
      source: SOURCE_URL,
      parsed: parsed.length,
      upserted: rows.length,
      sample: parsed.slice(0, 12).map((item) => ({
        season: item.seasonAlias,
        player: item.playerName,
        time:
          item.observationKind === "range"
            ? `${item.startHourType} ${item.startMinute}~${item.endMinute}`
            : `${item.startHourType} ${item.startMinute}`,
      })),
      mapping,
    });
  } catch (error) {
    console.error("Legacy refresh scrape failed:", error);
    return NextResponse.json(
      { error: "Legacy refresh scrape failed" },
      { status: 500 }
    );
  }
}
