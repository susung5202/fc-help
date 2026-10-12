import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

type PlayerMeta = {
  id: number;
  name: string;
};

type SeasonMeta = {
  seasonId: number;
  className: string;
};

type ObservationRow = {
  id: number;
  player_name: string;
  season_name: string;
  source_url: string;
};

function normalizePlayerName(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[\s·.'’_-]+/g, "");
}

function getYearPrefix(value: string) {
  return value.match(/(?:^|\D)(20|21|22|23|24|25|26)(?:\D|$)/)?.[1] ?? "";
}

function normalizeSeasonKey(value: string) {
  const officialCode = value.match(/^\s*([^()]+?)\s*\(/)?.[1];
  if (officialCode) {
    const key = officialCode
      .normalize("NFKC")
      .toLocaleLowerCase("en-US")
      .replace(/[^0-9a-z]+/g, "");

    if (key) return key;
  }

  const normalized = value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^0-9a-z가-힣]+/g, " ")
    .trim();

  const compact = normalized.replace(/\s+/g, "");
  const year = getYearPrefix(normalized);

  if (
    compact.includes("teamoftheseason") ||
    compact.includes("tots")
  ) {
    return `${year}tots`;
  }

  if (
    compact.includes("uefachampionsleague") ||
    compact.includes("ucl")
  ) {
    return `${year}ucl`;
  }

  if (
    compact.includes("fcosuperchampionsleague") ||
    compact.includes("superchampionsleague") ||
    compact.includes("fsl")
  ) {
    return `${year}fsl`;
  }

  if (compact.includes("devotedplayer")) {
    return `${year}dp`;
  }

  if (compact.includes("teamkoreaicon")) return "tki";
  if (compact.includes("teamkorea")) return "tk";
  if (compact.includes("pathtoglory")) return "ptg";
  if (compact.includes("warriorsofglory")) return "wg";
  if (compact.includes("winningstreak")) return "ws";
  if (compact.includes("untouchablechampions")) return "uc";

  return compact;
}

function seasonKeyFromSourceUrl(sourceUrl: string) {
  try {
    const url = new URL(sourceUrl);
    const match = url.pathname.match(/\/refresh\/seasons\/([^/]+)/i);
    return match?.[1]?.toLowerCase() ?? "";
  } catch {
    return "";
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "user-agent": "FC-Help/1.0 refresh-observation-mapper",
    },
  });

  if (!response.ok) {
    throw new Error(`Nexon metadata fetch failed: ${response.status} ${url}`);
  }

  return (await response.json()) as T;
}

export async function GET(request: Request) {
  try {
    const suppliedSecret = request.headers.get("x-fc-help-cron-secret");

    if (!suppliedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    const { data: secretRow, error: secretError } = await supabase
      .from("cron_secrets")
      .select("secret")
      .eq("name", "push_run")
      .maybeSingle();

    if (
      secretError ||
      !secretRow?.secret ||
      secretRow.secret !== suppliedSecret
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bootstrapSources = [
      {
        sourceUrl: "https://www.inven.co.kr/board/fifaonline4/3145/41287",
        route: "/api/refresh/scrape-legacy/cron",
      },
      {
        sourceUrl: "https://www.inven.co.kr/board/fifaonline4/3145/41940",
        route: "/api/refresh/scrape-legacy-v5/cron",
      },
      {
        sourceUrl: "https://www.inven.co.kr/board/fifaonline4/3145/43315",
        route: "/api/refresh/scrape-legacy-21toty/cron",
      },
      {
        sourceUrl: "https://www.inven.co.kr/board/fifaonline4/3309/36836",
        route: "/api/refresh/scrape-legacy-20ucl/cron",
      },
      {
        sourceUrl: "https://www.inven.co.kr/board/fifaonline4/3145/51542",
        route: "/api/refresh/scrape-inven-51542/cron",
      },
      {
        sourceUrl: "https://www.inven.co.kr/board/fifaonline4/3146/7560874",
        route: "/api/refresh/scrape-inven-7560874/cron",
      },
      {
        sourceUrl: "https://www.inven.co.kr/board/fifaonline4/3146/8043221",
        route: "/api/refresh/scrape-inven-8043221/cron",
      },
      {
        sourceUrl: "https://www.inven.co.kr/board/fifaonline4/3145/43746",
        route: "/api/refresh/scrape-legacy-collection/cron",
      },
    ];

    for (const source of bootstrapSources) {
      const { count, error } = await supabase
        .from("refresh_observations")
        .select("id", { count: "exact", head: true })
        .eq("source_url", source.sourceUrl);

      if (error) throw error;
      if ((count ?? 0) > 0) continue;

      const bootstrapUrl = new URL(source.route, request.url);
      const response = await fetch(bootstrapUrl, {
        headers: {
          "x-fc-help-cron-secret": suppliedSecret,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        console.warn(
          "Legacy refresh bootstrap failed:",
          source.route,
          response.status
        );
      }
    }

    const [
      players,
      seasons,
      { data: observationData, error: observationError },
    ] = await Promise.all([
      fetchJson<PlayerMeta[]>(
        "https://open.api.nexon.com/static/fconline/meta/spid.json"
      ),
      fetchJson<SeasonMeta[]>(
        "https://open.api.nexon.com/static/fconline/meta/seasonid.json"
      ),
      supabase
        .from("refresh_observations")
        .select("id, player_name, season_name, source_url")
        .is("player_spid", null)
        .order("id", { ascending: true })
        .limit(2000),
    ]);

    if (observationError) {
      throw observationError;
    }

    const seasonKeyById = new Map<number, string>();
    for (const season of seasons) {
      seasonKeyById.set(
        Number(season.seasonId),
        normalizeSeasonKey(season.className)
      );
    }

    const playersByName = new Map<string, PlayerMeta[]>();
    const playersBySeasonKey = new Map<string, PlayerMeta[]>();

    for (const player of players) {
      const key = normalizePlayerName(player.name);
      const rows = playersByName.get(key) ?? [];
      rows.push(player);
      playersByName.set(key, rows);

      const seasonId = Math.floor(Number(player.id) / 1_000_000);
      const seasonKey = seasonKeyById.get(seasonId) ?? "";
      if (seasonKey) {
        const seasonRows = playersBySeasonKey.get(seasonKey) ?? [];
        seasonRows.push(player);
        playersBySeasonKey.set(seasonKey, seasonRows);
      }
    }

    const mapped = new Map<number, number[]>();
    const unmatched: Array<{
      id: number;
      playerName: string;
      seasonName: string;
      seasonKey: string;
      candidateCount: number;
    }> = [];

    for (const observation of (observationData ?? []) as ObservationRow[]) {
      const nameKey = normalizePlayerName(observation.player_name);
      const candidates = playersByName.get(nameKey) ?? [];
      const storedSeasonKey = normalizeSeasonKey(observation.season_name);
      const sourceSeasonKey = seasonKeyFromSourceUrl(observation.source_url);

      let sameSeason = candidates.filter((candidate) => {
        const seasonId = Math.floor(Number(candidate.id) / 1_000_000);
        const candidateKey = seasonKeyById.get(seasonId) ?? "";

        return (
          candidateKey === storedSeasonKey ||
          (sourceSeasonKey !== "" && candidateKey === sourceSeasonKey)
        );
      });

      if (sameSeason.length !== 1) {
        const targetSeasonKey = storedSeasonKey || sourceSeasonKey;
        const observationNameKey = normalizePlayerName(
          observation.player_name
        );

        const fuzzySameSeason = (playersBySeasonKey.get(targetSeasonKey) ?? [])
          .filter((candidate) => {
            const candidateNameKey = normalizePlayerName(candidate.name);

            return (
              candidateNameKey === observationNameKey ||
              candidateNameKey.endsWith(observationNameKey) ||
              observationNameKey.endsWith(candidateNameKey) ||
              candidateNameKey.startsWith(observationNameKey) ||
              observationNameKey.startsWith(candidateNameKey)
            );
          });

        if (fuzzySameSeason.length === 1) {
          sameSeason = fuzzySameSeason;
        }
      }

      if (sameSeason.length !== 1) {
        unmatched.push({
          id: observation.id,
          playerName: observation.player_name,
          seasonName: observation.season_name,
          seasonKey: storedSeasonKey || sourceSeasonKey,
          candidateCount: sameSeason.length,
        });
        continue;
      }

      const spid = Number(sameSeason[0].id);
      const ids = mapped.get(spid) ?? [];
      ids.push(observation.id);
      mapped.set(spid, ids);
    }

    let updated = 0;

    for (const [spid, ids] of mapped.entries()) {
      const { error, count } = await supabase
        .from("refresh_observations")
        .update(
          {
            player_spid: spid,
            updated_at: new Date().toISOString(),
          },
          { count: "exact" }
        )
        .in("id", ids)
        .is("player_spid", null);

      if (error) {
        throw error;
      }

      updated += count ?? 0;
    }

    return NextResponse.json({
      success: true,
      checked: (observationData ?? []).length,
      mappedGroups: mapped.size,
      updated,
      unmatched: unmatched.length,
      unmatchedSample: unmatched.slice(0, 30),
    });
  } catch (error) {
    console.error("Refresh observation mapping failed:", error);

    return NextResponse.json(
      {
        error: "Refresh observation mapping failed",
      },
      { status: 500 }
    );
  }
}
