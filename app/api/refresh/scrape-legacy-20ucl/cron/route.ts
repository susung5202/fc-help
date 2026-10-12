import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

type HourType = "odd" | "even";

const SOURCE_URL =
  "https://www.inven.co.kr/board/fifaonline4/3309/36836";
const SEASON_NAME = "20 UCL (20 UEFA Champions League)";

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

function normalizePlayerKey(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^0-9a-z가-힣]+/g, "");
}

function sanitizePlayerName(value: string) {
  return value
    .replace(/^[-–—·•]+|[-–—·•]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePage(text: string) {
  const pattern =
    /([가-힣A-Za-zÀ-ž.·'’\- ]{1,40}?)\s+(홀수|짝수|홀|짝)\s*(\d{1,2})(?:\s*~\s*(\d{1,2}))?(?:\s*분)?/gi;

  const rows: Array<{
    playerName: string;
    hourType: HourType;
    startMinute: number;
    endMinute: number;
  }> = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(pattern)) {
    const playerName = sanitizePlayerName(match[1]);
    const startMinute = Number(match[3]);
    const endMinute = match[4] ? Number(match[4]) : startMinute;

    if (
      !playerName ||
      playerName.length > 30 ||
      !Number.isInteger(startMinute) ||
      !Number.isInteger(endMinute) ||
      startMinute < 0 ||
      startMinute > 59 ||
      endMinute < 0 ||
      endMinute > 59
    ) {
      continue;
    }

    const key = normalizePlayerKey(playerName);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    rows.push({
      playerName,
      hourType:
        match[2] === "홀수" || match[2] === "홀" ? "odd" : "even",
      startMinute,
      endMinute,
    });
  }

  return rows;
}

async function checkCronSecret(request: Request) {
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
  if (!(await checkCronSecret(request))) {
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
        { error: "20UCL source fetch failed", status: response.status },
        { status: 502 }
      );
    }

    const parsed = parsePage(htmlToText(html));
    const supabase = createAdminClient();

    const { data: existingData, error: existingError } = await supabase
      .from("refresh_observations")
      .select("source_record_key, player_spid")
      .eq("source_url", SOURCE_URL)
      .not("source_record_key", "is", null)
      .limit(1000);

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
        `inven:36836:20ucl:${normalizePlayerKey(item.playerName)}`;

      return {
        player_spid: existingSpidByKey.get(sourceRecordKey) ?? null,
        player_name: item.playerName,
        season_name: SEASON_NAME,
        observation_kind:
          item.startMinute === item.endMinute ? "exact" : "range",
        start_hour_type: item.hourType,
        start_minute: item.startMinute,
        end_hour_type: item.hourType,
        end_minute: item.endMinute,
        source_type: "scraped_public",
        source_name: "Inven 20UCL 인기매물 갱신시간 정리",
        source_url: SOURCE_URL,
        source_observation_count: 1,
        source_status: "estimated",
        source_observed_date: "2021-02-25",
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

    return NextResponse.json({
      success: true,
      parsed: parsed.length,
      upserted: rows.length,
      sample: parsed.slice(0, 15),
    });
  } catch (error) {
    console.error("20UCL refresh scrape failed:", error);
    return NextResponse.json(
      { error: "20UCL refresh scrape failed" },
      { status: 500 }
    );
  }
}
