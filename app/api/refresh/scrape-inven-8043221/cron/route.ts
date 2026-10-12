import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

type HourType = "odd" | "even";

type SectionConfig = {
  markers: string[];
  seasonName: string;
  sourceKey: string;
};

type ParsedRow = {
  playerName: string;
  seasonName: string;
  sourceKey: string;
  startHourType: HourType;
  startMinute: number;
  endHourType: HourType;
  endMinute: number;
};

const SOURCE_URL =
  "https://www.inven.co.kr/board/fifaonline4/3146/8043221";

const SECTIONS: SectionConfig[] = [
  { markers: ["17시즌"], seasonName: "17 LIVE (17 LIVE)", sourceKey: "17live" },
  { markers: ["18시즌"], seasonName: "18 LIVE (18 LIVE)", sourceKey: "18live" },
  { markers: ["라이브시즌"], seasonName: "20 LIVE (20 LIVE)", sourceKey: "20live" },
  { markers: ["NHD시즌"], seasonName: "NHD (National Hero Debut)", sourceKey: "nhd" },
  { markers: ["TKI"], seasonName: "TKI (Team Korea Icon)", sourceKey: "tki" },
  { markers: ["TB시즌"], seasonName: "TB (Tournament Best)", sourceKey: "tb" },
  { markers: ["18KFA시즌"], seasonName: "18 KFA (18 KFA)", sourceKey: "18kfa" },
  { markers: ["19KFA시즌"], seasonName: "19 KFA (19 KFA)", sourceKey: "19kfa" },
  { markers: ["18A시즌"], seasonName: "18 PLA (18 Premium Live Autumn)", sourceKey: "18pla" },
  { markers: ["18S시즌"], seasonName: "18 PLS (18 Premium Live Spring)", sourceKey: "18pls" },
  { markers: ["19A시즌"], seasonName: "19 PLA (19 Premium Live Autumn)", sourceKey: "19pla" },
  { markers: ["19S시즌"], seasonName: "19 PLS (19 Premium Live Spring)", sourceKey: "19pls" },
  { markers: ["TC시즌"], seasonName: "TC (Tournament Champions)", sourceKey: "tc" },
  { markers: ["HOT시즌"], seasonName: "HOT (Heroes Of the Team)", sourceKey: "hot" },
  { markers: ["20TOTY"], seasonName: "20 TOTY (20 Team Of The Year)", sourceKey: "20toty" },
  { markers: ["20N-TOTY", "20NTOTY"], seasonName: "20 TOTY-N (20 Team Of The Nominated)", sourceKey: "20totyn" },
  { markers: ["19UCL"], seasonName: "19 UCL (19 UEFA Champions League)", sourceKey: "19ucl" },
  { markers: ["LH시즌"], seasonName: "LH (Loyal Heroes)", sourceKey: "lh" },
  { markers: ["TKL"], seasonName: "TKL (TEAM K LEAGUE)", sourceKey: "tkl" },
  { markers: ["20KL"], seasonName: "20KLeague (20KLeague)", sourceKey: "20kl" },
  { markers: ["20TOTS"], seasonName: "20 TOTS (20 Team Of The Season)", sourceKey: "20tots" },
  { markers: ["20KLB", "20KB"], seasonName: "20KB (20 K-League Best)", sourceKey: "20kb" },
  { markers: ["VTR시즌", "VTR"], seasonName: "VTR (Veteran)", sourceKey: "vtr" },
  { markers: ["MC시즌"], seasonName: "MC (Multi-League Champions)", sourceKey: "mc" },
  { markers: ["20NG시즌"], seasonName: "20NG (20 NEW GENERATION)", sourceKey: "20ng" },
  { markers: ["20챔스", "20UCL"], seasonName: "20 UCL (20 UEFA Champions League)", sourceKey: "20ucl" },
  { markers: ["노스텔지아", "NTG"], seasonName: "NTG (Nostalgia)", sourceKey: "ntg" },
  { markers: ["UP시즌"], seasonName: "UP (Unsung Players)", sourceKey: "up" },
];

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

function htmlToLines(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/(?:p|div|li|tr|td|section|article)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\u00a0/g, " ")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function normalizePlayerKey(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^0-9a-z가-힣]+/g, "");
}

function compact(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleUpperCase("ko-KR")
    .replace(/[^0-9A-Z가-힣]+/g, "");
}

function findSection(line: string) {
  const lineKey = compact(line);

  for (const section of SECTIONS) {
    if (
      section.markers.some((marker) => {
        const markerKey = compact(marker);
        return lineKey === markerKey || lineKey === `${markerKey}시즌`;
      })
    ) {
      return section;
    }
  }

  return null;
}

function looksLikeHeading(line: string) {
  const key = compact(line);
  return (
    key.length <= 24 &&
    (
      key.endsWith("시즌") ||
      /^\d{2}(?:N)?TOTY$/.test(key) ||
      /^\d{2}UCL$/.test(key) ||
      /^(?:TKI|TKL|NTG|VTR|MC|UP|LH|HOT|TC|TB)$/.test(key) ||
      key.includes("아이콘")
    )
  );
}

function cleanNames(value: string) {
  return value
    .replace(/^\d+[.)]?\s*/, "")
    .replace(/^[·•:：-]+|[·•:：-]+$/g, "")
    .trim();
}

function parsePage(html: string): ParsedRow[] {
  const lines = htmlToLines(html);
  let current: SectionConfig | null = null;
  const rawRows: ParsedRow[] = [];

  const timePattern =
    /(.+?)\s*(홀수|짝수|홀|짝)\s*(?:시\s*)?(정각|\d{1,2})(?:\s*[~～-]\s*(\d{1,2}))?\s*(?:분)?/gi;

  for (const line of lines) {
    const section = findSection(line);
    if (section) {
      current = section;
      continue;
    }

    if (looksLikeHeading(line)) {
      current = null;
      continue;
    }

    if (!current) continue;

    for (const match of line.matchAll(timePattern)) {
      const namesText = cleanNames(match[1]);
      const startHourType: HourType =
        match[2] === "홀수" || match[2] === "홀" ? "odd" : "even";
      const startMinute = match[3] === "정각" ? 0 : Number(match[3]);
      const endMinute = match[4] ? Number(match[4]) : startMinute;
      const endHourType: HourType =
        match[4] && endMinute < startMinute
          ? startHourType === "odd"
            ? "even"
            : "odd"
          : startHourType;

      if (
        !Number.isInteger(startMinute) ||
        !Number.isInteger(endMinute) ||
        startMinute < 0 ||
        startMinute > 59 ||
        endMinute < 0 ||
        endMinute > 59
      ) {
        continue;
      }

      for (const rawName of namesText.split(/[,，]/)) {
        const playerName = rawName
          .replace(/\([^)]*\)/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        if (
          !playerName ||
          playerName === "모든선수" ||
          playerName === "모두" ||
          playerName.length > 45 ||
          !normalizePlayerKey(playerName)
        ) {
          continue;
        }

        rawRows.push({
          playerName,
          seasonName: current.seasonName,
          sourceKey: current.sourceKey,
          startHourType,
          startMinute,
          endHourType,
          endMinute,
        });
      }
    }
  }

  const counts = new Map<string, number>();
  for (const row of rawRows) {
    const key = `${row.sourceKey}:${normalizePlayerKey(row.playerName)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return rawRows.filter((row) => {
    const key = `${row.sourceKey}:${normalizePlayerKey(row.playerName)}`;
    return counts.get(key) === 1;
  });
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
          "FC-Help/1.0 (+https://fchelp.xyz) legacy-refresh-reference",
        accept: "text/html,application/xhtml+xml",
      },
    });
    const html = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        { error: "Inven 8043221 fetch failed", status: response.status },
        { status: 502 }
      );
    }

    const parsed = parsePage(html);
    const supabase = createAdminClient();

    const { data: existingData, error: existingError } = await supabase
      .from("refresh_observations")
      .select(
        "source_record_key, player_spid, player_name, season_name, observation_kind, start_hour_type, start_minute, end_hour_type, end_minute"
      )
      .eq("source_url", SOURCE_URL)
      .limit(5000);

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
        `inven:8043221:${item.sourceKey}:${normalizePlayerKey(item.playerName)}`;
      const observationKind =
        item.startHourType === item.endHourType &&
        item.startMinute === item.endMinute
          ? "exact"
          : "range";

      const row = {
        player_spid: existingSpidByKey.get(sourceRecordKey) ?? null,
        player_name: item.playerName,
        season_name: item.seasonName,
        observation_kind: observationKind,
        start_hour_type: item.startHourType,
        start_minute: item.startMinute,
        end_hour_type: item.endHourType,
        end_minute: item.endMinute,
        source_type: "scraped_public" as const,
        source_name: "Inven 초창기 갱신시간 대형 모음",
        source_url: SOURCE_URL,
        source_observation_count: 1,
        source_status: "estimated" as const,
        source_observed_date: "2024-01-12",
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
      bySeason: SECTIONS.map((section) => ({
        season: section.sourceKey,
        count: parsed.filter((row) => row.sourceKey === section.sourceKey)
          .length,
      })).filter((item) => item.count > 0),
      sample: parsed.slice(0, 25),
    });
  } catch (error) {
    console.error("Inven 8043221 scrape failed:", error);
    return NextResponse.json(
      {
        error: "Inven 8043221 scrape failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
