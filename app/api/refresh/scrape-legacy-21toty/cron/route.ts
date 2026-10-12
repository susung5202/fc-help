import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

type HourType = "odd" | "even";

type Observation = {
  playerName: string;
  seasonAlias: string;
  seasonName: string;
  hourType: HourType;
  minute: number;
};

const SOURCE_URL =
  "https://www.inven.co.kr/board/fifaonline4/3145/43315";

const SEASONS = [
  ["21TOTY", "21 TOTY (21 Team Of The Year)"],
  ["21TOTY-N", "21 TOTY-N (21 Team Of The Nominated)"],
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

function normalizePlayerKey(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^0-9a-z가-힣]+/g, "");
}

function parsePage(text: string): Observation[] {
  const seasonMap = new Map(
    SEASONS.map(([alias, seasonName]) => [alias, seasonName])
  );
  const parsed: Observation[] = [];

  for (const [alias] of SEASONS) {
    const sectionPattern = new RegExp(
      `\\[${alias.replace("-", "\\-")}\\]([\\s\\S]*?)(?=\\[[^\\]]+\\]|$)`,
      "i"
    );
    const section = text.match(sectionPattern)?.[1] ?? "";
    const seasonName = seasonMap.get(alias);
    if (!section || !seasonName) continue;

    const rowPattern =
      /([가-힣A-Za-zÀ-ž.·\- ]{1,40}?)\s*-?\s*(홀수|짝수)\s*(\d{1,2})분/gi;

    const seen = new Set<string>();
    for (const match of section.matchAll(rowPattern)) {
      const playerName = match[1].replace(/\s+/g, " ").trim();
      const minute = Number(match[3]);

      if (
        !playerName ||
        !Number.isInteger(minute) ||
        minute < 0 ||
        minute > 59
      ) {
        continue;
      }

      const key = normalizePlayerKey(playerName);
      if (seen.has(key)) continue;
      seen.add(key);

      parsed.push({
        playerName,
        seasonAlias: alias,
        seasonName,
        hourType: match[2] === "홀수" ? "odd" : "even",
        minute,
      });
    }
  }

  return parsed;
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
        { error: "21TOTY source fetch failed", status: response.status },
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
        `inven:43315:${item.seasonAlias.toLocaleLowerCase("ko-KR")}:${normalizePlayerKey(
          item.playerName
        )}`;

      return {
        player_spid: existingSpidByKey.get(sourceRecordKey) ?? null,
        player_name: item.playerName,
        season_name: item.seasonName,
        observation_kind: "exact",
        start_hour_type: item.hourType,
        start_minute: item.minute,
        end_hour_type: item.hourType,
        end_minute: item.minute,
        source_type: "scraped_public",
        source_name: "Inven 21TOTY 전체 갱신시간 정리",
        source_url: SOURCE_URL,
        source_observation_count: 1,
        source_status: "estimated",
        source_observed_date: "2021-01-24",
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
      headers: { "x-fc-help-cron-secret": auth.secret },
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
      parsed: parsed.length,
      upserted: rows.length,
      mapping,
    });
  } catch (error) {
    console.error("21TOTY refresh scrape failed:", error);
    return NextResponse.json(
      { error: "21TOTY refresh scrape failed" },
      { status: 500 }
    );
  }
}
