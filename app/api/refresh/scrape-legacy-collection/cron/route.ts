import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

type HourType = "odd" | "even";

type SectionConfig = {
  markers: string[];
  seasonName: string;
  sourceKey: string;
};

const SOURCE_URL =
  "https://www.inven.co.kr/board/fifaonline4/3145/43746";

const SECTIONS: SectionConfig[] = [
  {
    markers: ["NHD시즌"],
    seasonName: "NHD (National Hero Debut)",
    sourceKey: "nhd",
  },
  {
    markers: ["TC시즌"],
    seasonName: "TC (Tournament Champions)",
    sourceKey: "tc",
  },
  {
    markers: ["HOT시즌"],
    seasonName: "HOT (Heroes Of the Team)",
    sourceKey: "hot",
  },
  {
    markers: ["19UCL"],
    seasonName: "19 UCL (19 UEFA Champions League)",
    sourceKey: "19ucl",
  },
  {
    markers: ["20UCL"],
    seasonName: "20 UCL (20 UEFA Champions League)",
    sourceKey: "20ucl",
  },
  {
    markers: ["20TOTY"],
    seasonName: "20 TOTY (20 Team Of The Year)",
    sourceKey: "20toty",
  },
  {
    markers: ["20N-TOTY", "20N TOTY"],
    seasonName: "20 TOTY-N (20 Team Of The Nominated)",
    sourceKey: "20totyn",
  },
  {
    markers: ["LH시즌"],
    seasonName: "LH (Loyal Heroes)",
    sourceKey: "lh",
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

function findSection(line: string) {
  const compact = line.replace(/\s+/g, "").toUpperCase();

  for (const section of SECTIONS) {
    if (
      section.markers.some(
        (marker) => compact === marker.replace(/\s+/g, "").toUpperCase()
      )
    ) {
      return section;
    }
  }

  return null;
}

function looksLikeOtherSection(line: string) {
  const compact = line.replace(/\s+/g, "");
  return (
    compact.length <= 30 &&
    (
      /시즌$/i.test(compact) ||
      /^\d{2}(?:N-?)?TOTY$/i.test(compact) ||
      /^\d{2}UCL$/i.test(compact) ||
      /^(?:NHD|TC|HOT|LH|GR|TT|TB|MC|VTR|MOG|OTW|COC)$/i.test(compact)
    )
  );
}

function parseRows(lines: string[]) {
  let current: SectionConfig | null = null;
  const results: Array<{
    playerName: string;
    seasonName: string;
    sourceKey: string;
    hourType: HourType;
    startMinute: number;
    endMinute: number;
  }> = [];
  const seen = new Set<string>();

  const rowPattern =
    /([가-힣A-Za-zÀ-ž.·'’\- ]{1,45}?)\s*(홀수|짝수|홀|짝)\s*(?:시\s*)?(정각|\d{1,2})(?:\s*~\s*(\d{1,2}))?\s*(?:분)?/gi;

  for (const line of lines) {
    const section = findSection(line);
    if (section) {
      current = section;
      continue;
    }

    if (looksLikeOtherSection(line)) {
      current = null;
      continue;
    }

    if (!current) continue;

    for (const match of line.matchAll(rowPattern)) {
      const playerName = match[1].replace(/\s+/g, " ").trim();
      const startMinute = match[3] === "정각" ? 0 : Number(match[3]);
      const endMinute = match[4] ? Number(match[4]) : startMinute;

      if (
        !playerName ||
        playerName === "모든선수" ||
        playerName.length > 40 ||
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
        `${current.sourceKey}:${normalizePlayerKey(playerName)}`;
      if (!normalizePlayerKey(playerName) || seen.has(key)) continue;
      seen.add(key);

      results.push({
        playerName,
        seasonName: current.seasonName,
        sourceKey: current.sourceKey,
        hourType:
          match[2] === "홀수" || match[2] === "홀" ? "odd" : "even",
        startMinute,
        endMinute,
      });
    }
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
          "FC-Help/1.0 (+https://fchelp.xyz) legacy-refresh-reference",
        accept: "text/html,application/xhtml+xml",
      },
    });

    const html = await response.text();
    if (!response.ok) {
      return NextResponse.json(
        { error: "Refresh collection fetch failed", status: response.status },
        { status: 502 }
      );
    }

    const parsed = parseRows(htmlToLines(html));
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
        `inven:43746:${item.sourceKey}:${normalizePlayerKey(item.playerName)}`;

      return {
        player_spid: existingSpidByKey.get(sourceRecordKey) ?? null,
        player_name: item.playerName,
        season_name: item.seasonName,
        observation_kind:
          item.startMinute === item.endMinute ? "exact" : "range",
        start_hour_type: item.hourType,
        start_minute: item.startMinute,
        end_hour_type: item.hourType,
        end_minute: item.endMinute,
        source_type: "scraped_public",
        source_name: "Inven 2021 갱신시간 모음집",
        source_url: SOURCE_URL,
        source_observation_count: 1,
        source_status: "estimated",
        source_observed_date: "2021-03-06",
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
      bySeason: SECTIONS.map((section) => ({
        season: section.sourceKey,
        count: parsed.filter((row) => row.sourceKey === section.sourceKey)
          .length,
      })),
      sample: parsed.slice(0, 20),
    });
  } catch (error) {
    console.error("Refresh collection scrape failed:", error);
    return NextResponse.json(
      { error: "Refresh collection scrape failed" },
      { status: 500 }
    );
  }
}
