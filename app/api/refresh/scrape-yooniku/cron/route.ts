import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

type HourType = "odd" | "even";

type SourceConfig = {
  slug: string;
  seasonName: string;
  url: string;
};

const SOURCES: SourceConfig[] = [
  {
    slug: "bld",
    seasonName: "BLD (Best Legends)",
    url: "https://www.yooniku.com/2025/07/fc-bld.html",
  },
  {
    slug: "wb",
    seasonName: "WB (Wonderboys)",
    url: "https://www.yooniku.com/2025/07/fc-wb.html",
  },
  {
    slug: "no7",
    seasonName: "NO7 (NUMBER 7)",
    url: "https://www.yooniku.com/2025/07/fc-no7.html",
  },
  {
    slug: "25hr",
    seasonName: "25HR (25 Heroes)",
    url: "https://www.yooniku.com/2025/07/fc-25hr.html",
  },
  {
    slug: "24tots",
    seasonName: "24 TOTS (24 Team Of The Season)",
    url: "https://www.yooniku.com/2025/07/fc-24tots.html",
  },
  {
    slug: "cc",
    seasonName: "CC (CenturyClub)",
    url: "https://www.yooniku.com/2025/07/fc-cc.html",
  },
  {
    slug: "gru",
    seasonName: "GRU (Greatest Runner-Ups)",
    url: "https://www.yooniku.com/2025/07/fc-gru.html",
  },
  {
    slug: "25tots",
    seasonName: "25 TOTS (25 Team Of The Season)",
    url: "https://www.yooniku.com/2025/07/fc-25tots.html",
  },
  {
    slug: "24ep",
    seasonName: "24EP (2024 Energetic Player)",
    url: "https://www.yooniku.com/2025/07/fc-24ep.html",
  },
  {
    slug: "le",
    seasonName: "LE (Legend of Europa)",
    url: "https://www.yooniku.com/2025/07/fc-le.html",
  },
  {
    slug: "24ucl",
    seasonName: "24 UCL (24 UEFA Champions League)",
    url: "https://www.yooniku.com/2025/07/fc-24ucl.html",
  },
  {
    slug: "dc",
    seasonName: "DC (Decade)",
    url: "https://www.yooniku.com/2025/07/fc-dc.html",
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

function htmlToLines(html: string) {
  return decodeHtmlEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/(?:h1|h2|h3|p|div|li|tr|td|section|article)>/gi, "\n")
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

function cleanPlayerName(value: string) {
  return value
    .replace(/^[-–—·•]+|[-–—·•]+$/g, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePage(html: string) {
  const lines = htmlToLines(html);
  let hourType: HourType | null = null;
  const rows: Array<{
    playerName: string;
    hourType: HourType;
    minute: number;
  }> = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (/짝수\s*시간/.test(line)) {
      hourType = "even";
      continue;
    }

    if (/홀수\s*시간/.test(line)) {
      hourType = "odd";
      continue;
    }

    if (!hourType) continue;

    const match = line.match(/^(\d{1,2})분\s*[:：]\s*(.+)$/);
    if (!match) continue;

    const minute = Number(match[1]);
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) continue;

    const playerText = match[2]
      .replace(/[。；;]+$/g, "")
      .replace(/\s{2,}/g, " ");

    for (const rawName of playerText.split(/[,，]/)) {
      const playerName = cleanPlayerName(rawName);
      const key = normalizePlayerKey(playerName);

      if (
        !playerName ||
        !key ||
        playerName.length > 50 ||
        seen.has(key)
      ) {
        continue;
      }

      seen.add(key);
      rows.push({
        playerName,
        hourType,
        minute,
      });
    }
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
    const supabase = createAdminClient();

    const { data: existingData, error: existingError } = await supabase
      .from("refresh_observations")
      .select(
        "source_record_key, player_spid, player_name, season_name, observation_kind, start_hour_type, start_minute, end_hour_type, end_minute, source_url"
      )
      .in(
        "source_url",
        SOURCES.map((source) => source.url)
      )
      .limit(10000);

    if (existingError) throw existingError;

    const existingSpidByKey = new Map<string, number | null>();
    const existingPatternKeys = new Set<string>();

    const patternKey = (row: {
      source_url: string;
      player_name: string;
      season_name: string;
      observation_kind: string;
      start_hour_type: string;
      start_minute: number;
      end_hour_type: string;
      end_minute: number;
    }) =>
      [
        row.source_url,
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
          source_url: String(row.source_url),
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

    const fetched = await Promise.all(
      SOURCES.map(async (source) => {
        const response = await fetch(source.url, {
          cache: "no-store",
          headers: {
            "user-agent":
              "FC-Help/1.0 (+https://fchelp.xyz) public-refresh-reference",
            accept: "text/html,application/xhtml+xml",
          },
        });
        const html = await response.text();

        return {
          source,
          status: response.status,
          ok: response.ok,
          html,
        };
      })
    );

    let totalParsed = 0;
    let totalUpserted = 0;
    const pages: Array<{
      slug: string;
      status: number;
      parsed: number;
      sample: string[];
    }> = [];

    for (const page of fetched) {
      if (!page.ok) {
        pages.push({
          slug: page.source.slug,
          status: page.status,
          parsed: 0,
          sample: [],
        });
        continue;
      }

      const parsed = parsePage(page.html);
      totalParsed += parsed.length;

      const rows = parsed.flatMap((item) => {
        const sourceRecordKey =
          `yooniku:${page.source.slug}:${normalizePlayerKey(item.playerName)}`;

        const row = {
          player_spid: existingSpidByKey.get(sourceRecordKey) ?? null,
          player_name: item.playerName,
          season_name: page.source.seasonName,
          observation_kind: "exact" as const,
          start_hour_type: item.hourType,
          start_minute: item.minute,
          end_hour_type: item.hourType,
          end_minute: item.minute,
          source_type: "scraped_public" as const,
          source_name: "이쿠로그 시즌 갱신시간 모음",
          source_url: page.source.url,
          source_observation_count: 1,
          source_status: "reported" as const,
          source_observed_date: "2025-07-01",
          observer_key: sourceRecordKey,
          source_record_key: sourceRecordKey,
          updated_at: new Date().toISOString(),
        };

        const hasOwnRow = existingSpidByKey.has(sourceRecordKey);
        const hasExistingPattern = existingPatternKeys.has(
          patternKey({
            source_url: row.source_url,
            player_name: row.player_name,
            season_name: row.season_name,
            observation_kind: row.observation_kind,
            start_hour_type: row.start_hour_type,
            start_minute: row.start_minute,
            end_hour_type: row.end_hour_type,
            end_minute: row.end_minute,
          })
        );

        if (!hasOwnRow && hasExistingPattern) return [];
        return [row];
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
        slug: page.source.slug,
        status: page.status,
        parsed: parsed.length,
        sample: parsed.slice(0, 5).map((item) => item.playerName),
      });
    }

    return NextResponse.json({
      success: true,
      sourcePages: SOURCES.length,
      totalParsed,
      totalUpserted,
      pages,
    });
  } catch (error) {
    console.error("Yooniku refresh scrape failed:", error);
    return NextResponse.json(
      {
        error: "Yooniku refresh scrape failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
