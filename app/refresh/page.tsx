import type { Metadata } from "next";
import Link from "next/link";
import ServiceUsageNotes from "@/components/ServiceUsageNotes";
import { getPlayerOvrMap, type PlayerOvrInfo } from "@/lib/fconline/playerOvr";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveRefreshPattern, type RefreshReferencePatternRow } from "@/lib/refresh/resolvePattern";

export const metadata: Metadata = {
  title: "갱신시간 | FC Help",
  description: "FC 온라인 갱신시간 제보 및 공개 참고값을 확인하고 알림을 설정해 보세요.",
  alternates: { canonical: "/refresh" },
};

type Player = {
  id: number;
  name: string;
};

type Season = {
  seasonId: number;
  className: string;
  seasonImg: string;
};

type SortMode = "default" | "ovr" | "nearest";
type HourType = "odd" | "even" | "every" | "unknown";

type RefreshReportRow = {
  player_spid: number | string;
  hour_type: HourType;
  refresh_minute: number | null;
};

type NearestRefreshInfo = {
  minutesUntil: number;
  label: string;
};

async function getPlayers(): Promise<Player[]> {
  const res = await fetch(
    "https://open.api.nexon.com/static/fconline/meta/spid.json",
    { next: { revalidate: 86400 } }
  );

  if (!res.ok) {
    throw new Error("선수 데이터를 불러오지 못했습니다.");
  }

  return res.json();
}

async function getSeasons(): Promise<Season[]> {
  const res = await fetch(
    "https://open.api.nexon.com/static/fconline/meta/seasonid.json",
    { next: { revalidate: 86400 } }
  );

  if (!res.ok) {
    throw new Error("시즌 데이터를 불러오지 못했습니다.");
  }

  return res.json();
}

function getKstHourMinute(now: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = formatter.formatToParts(now);

  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? 0),
    minute: Number(parts.find((part) => part.type === "minute")?.value ?? 0),
  };
}

function getNextRefreshInfo(
  hourType: HourType,
  minute: number,
  now: Date
): NearestRefreshInfo | null {
  const { hour: currentHour, minute: currentMinute } = getKstHourMinute(now);

  for (let hourOffset = 0; hourOffset <= 48; hourOffset++) {
    const candidateHour = (currentHour + hourOffset) % 24;
    const matches =
      hourType === "every" ||
      (hourType === "odd" && candidateHour % 2 === 1) ||
      (hourType === "even" && candidateHour % 2 === 0);

    if (!matches) continue;

    const deltaMinutes = hourOffset * 60 + minute - currentMinute;
    if (deltaMinutes <= 0) continue;

    const candidate = new Date(now.getTime() + deltaMinutes * 60 * 1000);
    const time = candidate.toLocaleTimeString("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    return {
      minutesUntil: deltaMinutes,
      label: `${time} · ${deltaMinutes}분 후`,
    };
  }

  return null;
}

async function getNearestRefreshMap(spids: number[]) {
  const result = new Map<number, NearestRefreshInfo | null>();
  if (spids.length === 0) return result;

  try {
    const supabase = createAdminClient();
    const [{ data: reportsData, error: reportsError }, { data: referenceData, error: referenceError }] =
      await Promise.all([
        supabase
          .from("refresh_reports")
          .select("player_spid, hour_type, refresh_minute")
          .in("player_spid", spids),
        supabase
          .from("refresh_reference_times")
          .select("player_spid, hour_type, refresh_minute")
          .in("player_spid", spids),
      ]);

    if (reportsError || referenceError) {
      console.error(
        "갱신시간 정렬용 조회 실패",
        reportsError?.message || referenceError?.message
      );
      return result;
    }

    const grouped = new Map<number, RefreshReportRow[]>();
    for (const row of (reportsData ?? []) as RefreshReportRow[]) {
      const spid = Number(row.player_spid);
      if (!Number.isFinite(spid)) continue;
      const rows = grouped.get(spid) ?? [];
      rows.push(row);
      grouped.set(spid, rows);
    }

    const references = new Map<number, RefreshReferencePatternRow>();
    for (const row of (referenceData ?? []) as Array<{
      player_spid: number | string;
      hour_type: "odd" | "even" | "every";
      refresh_minute: number;
    }>) {
      const spid = Number(row.player_spid);
      if (!Number.isFinite(spid)) continue;
      references.set(spid, {
        hour_type: row.hour_type,
        refresh_minute: row.refresh_minute,
      });
    }

    const now = new Date();

    for (const spid of spids) {
      const resolved = resolveRefreshPattern(
        grouped.get(spid) ?? [],
        references.get(spid) ?? null
      );

      result.set(
        spid,
        resolved
          ? getNextRefreshInfo(resolved.hourType, resolved.minute, now)
          : null
      );
    }
  } catch (error) {
    console.error("갱신시간 정렬 계산 실패", error);
  }

  return result;
}

type RefreshShowcaseRow = {
  player_spid: number | string;
  hour_type: "odd" | "even" | "every";
  refresh_minute: number;
};

type RefreshDemandRow = {
  playerSpid: number;
  requestCount: number;
};

const FEATURED_REFRESH_NAMES = [
  "크리스티아누 호날두",
  "손흥민",
  "루드 굴리트",
  "차범근",
  "안드리 셰우첸코",
] as const;

async function getRefreshShowcase() {
  try {
    const supabase = createAdminClient();
    const { data, error, count } = await supabase
      .from("refresh_reference_times")
      .select("player_spid, hour_type, refresh_minute", { count: "exact" })
      .order("player_spid", { ascending: true })
      .limit(200);

    if (error) throw error;

    return {
      count: count ?? 0,
      rows: (data ?? []) as RefreshShowcaseRow[],
    };
  } catch (error) {
    console.error("갱신시간 초기 데이터 조회 실패", error);
    return { count: 0, rows: [] as RefreshShowcaseRow[] };
  }
}

async function getRefreshDemandQueue(): Promise<RefreshDemandRow[]> {
  try {
    const supabase = createAdminClient();
    const { data: alertsData, error: alertsError } = await supabase
      .from("refresh_alerts")
      .select("player_spid")
      .eq("enabled", true)
      .limit(2000);

    if (alertsError) throw alertsError;

    const requestCounts = new Map<number, number>();
    for (const row of (alertsData ?? []) as Array<{ player_spid: number | string }>) {
      const spid = Number(row.player_spid);
      if (!Number.isFinite(spid)) continue;
      requestCounts.set(spid, (requestCounts.get(spid) ?? 0) + 1);
    }

    const candidateSpids = Array.from(requestCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 100)
      .map(([spid]) => spid);

    if (candidateSpids.length === 0) return [];

    const [
      { data: referenceData, error: referenceError },
      { data: reportData, error: reportError },
    ] = await Promise.all([
      supabase
        .from("refresh_reference_times")
        .select("player_spid")
        .in("player_spid", candidateSpids),
      supabase
        .from("refresh_reports")
        .select("player_spid, hour_type, refresh_minute")
        .in("player_spid", candidateSpids),
    ]);

    if (referenceError || reportError) {
      throw referenceError ?? reportError;
    }

    const knownSpids = new Set<number>();

    for (const row of (referenceData ?? []) as Array<{ player_spid: number | string }>) {
      const spid = Number(row.player_spid);
      if (Number.isFinite(spid)) knownSpids.add(spid);
    }

    for (const row of (reportData ?? []) as RefreshReportRow[]) {
      const spid = Number(row.player_spid);
      if (
        Number.isFinite(spid) &&
        row.hour_type !== "unknown" &&
        row.refresh_minute !== null
      ) {
        knownSpids.add(spid);
      }
    }

    return Array.from(requestCounts.entries())
      .filter(([spid]) => !knownSpids.has(spid))
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return b[0] - a[0];
      })
      .slice(0, 8)
      .map(([playerSpid, requestCount]) => ({
        playerSpid,
        requestCount,
      }));
  } catch (error) {
    console.error("갱신시간 수요 목록 조회 실패", error);
    return [];
  }
}

async function getObservationHintMap(
  players: Player[],
  seasonMap: Map<number, Season>
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (players.length === 0) return result;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("refresh_observations")
      .select("player_spid, player_name, season_name, observation_kind")
      .limit(500);

    if (error) throw error;

    const direct = new Map<number, "exact" | "range">();
    const byNameSeason = new Map<string, "exact" | "range">();

    for (const row of (data ?? []) as Array<{
      player_spid: number | string | null;
      player_name: string;
      season_name: string;
      observation_kind: "exact" | "range";
    }>) {
      const kind = row.observation_kind;
      const spid = row.player_spid === null ? null : Number(row.player_spid);

      if (spid !== null && Number.isFinite(spid)) {
        const current = direct.get(spid);
        if (!current || kind === "exact") direct.set(spid, kind);
      }

      const key = `${row.player_name}::${row.season_name}`;
      const current = byNameSeason.get(key);
      if (!current || kind === "exact") byNameSeason.set(key, kind);
    }

    for (const player of players) {
      const directKind = direct.get(player.id);
      const seasonId = Math.floor(player.id / 1_000_000);
      const seasonName = seasonMap.get(seasonId)?.className ?? "";
      const namedKind = byNameSeason.get(`${player.name}::${seasonName}`);
      const kind = directKind ?? namedKind;

      if (kind === "exact") {
        result.set(player.id, "웹 exact 참고값 있음");
      } else if (kind === "range") {
        result.set(player.id, "웹 관측 범위 있음");
      }
    }
  } catch (error) {
    console.error("웹 관측 표시 조회 실패", error);
  }

  return result;
}

export default async function RefreshPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  const { q = "", sort = "default" } = await searchParams;
  const query = q.trim();
  const sortMode: SortMode =
    sort === "ovr" ? "ovr" : sort === "nearest" ? "nearest" : "default";

  const [players, seasons, showcase, demandQueue] = await Promise.all([
    getPlayers(),
    getSeasons(),
    getRefreshShowcase(),
    getRefreshDemandQueue(),
  ]);

  const seasonMap = new Map(
    seasons.map((season) => [Number(season.seasonId), season])
  );

  const matchedPlayers = query
    ? players
        .filter((player) =>
          player.name.toLowerCase().includes(query.toLowerCase())
        )
        .sort((a, b) => b.id - a.id)
        .slice(0, 100)
    : [];

  const [ovrMap, nearestRefreshMap, observationHintMap] = await Promise.all([
    query && sortMode === "ovr"
      ? getPlayerOvrMap(matchedPlayers.map((player) => player.id))
      : Promise.resolve(new Map<number, PlayerOvrInfo | null>()),
    query
      ? getNearestRefreshMap(matchedPlayers.map((player) => player.id))
      : Promise.resolve(new Map<number, NearestRefreshInfo | null>()),
    query
      ? getObservationHintMap(matchedPlayers, seasonMap)
      : Promise.resolve(new Map<number, string>()),
  ]);

  const playerMap = new Map(players.map((player) => [player.id, player]));
  const featuredRank = new Map<string, number>(
    FEATURED_REFRESH_NAMES.map((name, index) => [name, index])
  );
  const showcaseCards = showcase.rows
    .map((row) => {
      const spid = Number(row.player_spid);
      const player = playerMap.get(spid);
      if (!player) return null;
      return {
        player,
        refresh: getNextRefreshInfo(row.hour_type, row.refresh_minute, new Date()),
      };
    })
    .filter(
      (item): item is { player: Player; refresh: NearestRefreshInfo | null } =>
        item !== null
    )
    .sort((a, b) => {
      const aRank = featuredRank.get(a.player.name) ?? Number.MAX_SAFE_INTEGER;
      const bRank = featuredRank.get(b.player.name) ?? Number.MAX_SAFE_INTEGER;
      return aRank - bRank;
    })
    .slice(0, 12);

  const demandCards = demandQueue
    .map((item) => {
      const player = playerMap.get(item.playerSpid);
      if (!player) return null;
      return {
        player,
        requestCount: item.requestCount,
      };
    })
    .filter(
      (item): item is { player: Player; requestCount: number } => item !== null
    );

  const results = [...matchedPlayers].sort((a, b) => {
    if (sortMode === "ovr") {
      const aOvr = ovrMap.get(a.id)?.ovr ?? -1;
      const bOvr = ovrMap.get(b.id)?.ovr ?? -1;
      if (bOvr !== aOvr) return bOvr - aOvr;
    }

    if (sortMode === "nearest") {
      const aMinutes = nearestRefreshMap.get(a.id)?.minutesUntil ?? Number.MAX_SAFE_INTEGER;
      const bMinutes = nearestRefreshMap.get(b.id)?.minutesUntil ?? Number.MAX_SAFE_INTEGER;
      if (aMinutes !== bMinutes) return aMinutes - bMinutes;
    }

    return b.id - a.id;
  });

  return (
    <main className="min-h-screen bg-[#0f1115] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-2xl font-extrabold tracking-tight">
            FC <span className="text-lime-400">Help</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-gray-300 md:flex">
            <Link href="/players" className="transition hover:text-white">
              선수 DB
            </Link>
            <Link href="/refresh" className="text-white">
              갱신시간
            </Link>
            <Link href="/squad" className="transition hover:text-white">
              스쿼드
            </Link>
            <Link href="/community" className="transition hover:text-white">
              커뮤니티
            </Link>
          </nav>

          <Link
            href="/login"
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black"
          >
            로그인
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <p className="text-sm font-semibold text-lime-400">REFRESH TIME</p>
        <h1 className="mt-2 text-4xl font-bold">갱신시간</h1>
        <p className="mt-3 text-gray-400">
          선수별 2시간 거래량 갱신 기준 시각을 확인하고 알림을 설정할 수 있습니다. 기준가·상한가·하한가는 이 시각 이후 약 0~20분 사이에 변동될 수 있습니다.
        </p>

        <form
          action="/refresh"
          method="GET"
          className="mt-10 flex max-w-3xl rounded-2xl border border-white/10 bg-[#181b21] p-2"
        >
          <input type="hidden" name="sort" value={sortMode} />
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="갱신시간을 확인할 선수 이름을 검색하세요"
            className="flex-1 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500"
          />
          <button
            type="submit"
            className="rounded-xl bg-lime-400 px-6 py-3 text-sm font-bold text-black transition hover:bg-lime-300"
          >
            검색
          </button>
        </form>

        <div className="mt-12">
          {!query ? (
            <div>
              <div className="rounded-2xl border border-lime-300/15 bg-lime-300/[0.04] px-5 py-5 sm:px-6">
                <p className="text-xs font-black tracking-[0.14em] text-lime-400">DATA BOOTSTRAP</p>
                <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black">바로 확인 가능한 갱신시간</h2>
                    <p className="mt-2 text-sm leading-6 text-gray-400">
                      출처가 표시된 초기 공개 참고값 {showcase.count}장을 먼저 제공하고, FC Help 유저 제보가 쌓이면 제보 결과로 계속 보정합니다.
                    </p>
                  </div>
                  <span className="rounded-full border border-lime-300/20 bg-black/20 px-3 py-1.5 text-xs font-black text-lime-200">
                    현재 {showcase.count}장
                  </span>
                </div>
              </div>

              {showcaseCards.length > 0 ? (
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {showcaseCards.map(({ player, refresh }) => {
                    const seasonId = Math.floor(player.id / 1_000_000);
                    const season = seasonMap.get(seasonId);
                    return (
                      <RefreshPlayerCard
                        key={player.id}
                        player={player}
                        season={season}
                        nearestRefresh={refresh}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-[#181b21] px-6 py-16 text-center">
                  <p className="text-lg font-semibold">갱신시간을 확인할 선수를 검색해주세요.</p>
                </div>
              )}

              {demandCards.length > 0 && (
                <section className="mt-12">
                  <p className="text-xs font-black tracking-[0.14em] text-amber-300">
                    REQUEST QUEUE
                  </p>
                  <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-black">갱신시간 요청 많은 선수</h2>
                      <p className="mt-2 text-sm leading-6 text-gray-400">
                        아직 기준값이 없는 선수 중 갱신 알림 등록이 많은 순서입니다.
                        먼저 알림을 등록해두면 데이터가 확보된 뒤 기존 설정으로 알림이 적용됩니다.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {demandCards.map(({ player, requestCount }) => {
                      const seasonId = Math.floor(player.id / 1_000_000);
                      const season = seasonMap.get(seasonId);
                      return (
                        <RefreshPlayerCard
                          key={player.id}
                          player={player}
                          season={season}
                          demandCount={requestCount}
                        />
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          ) : results.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#181b21] px-6 py-16 text-center">
              <p className="font-semibold">
                &apos;{query}&apos; 검색 결과가 없습니다.
              </p>
              <p className="mt-2 text-sm text-gray-500">
                다른 선수 이름으로 검색해보세요.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm text-gray-500">검색 결과</p>
                  <h2 className="mt-1 text-2xl font-bold">{query}</h2>
                  <span className="mt-1 block text-sm text-gray-500">
                    {results.length}개
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <SortLink
                    href={`/refresh?q=${encodeURIComponent(query)}&sort=default`}
                    active={sortMode === "default"}
                  >
                    기본순
                  </SortLink>
                  <SortLink
                    href={`/refresh?q=${encodeURIComponent(query)}&sort=ovr`}
                    active={sortMode === "ovr"}
                  >
                    OVR 높은순
                  </SortLink>
                  <SortLink
                    href={`/refresh?q=${encodeURIComponent(query)}&sort=nearest`}
                    active={sortMode === "nearest"}
                  >
                    가까운 갱신시간순
                  </SortLink>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {results.map((player) => {
                  const seasonId = Math.floor(player.id / 1_000_000);
                  const season = seasonMap.get(seasonId);

                  return (
                    <RefreshPlayerCard
                      key={player.id}
                      player={player}
                      season={season}
                      ovrInfo={ovrMap.get(player.id) ?? null}
                      nearestRefresh={nearestRefreshMap.get(player.id) ?? null}
                      observationHint={observationHintMap.get(player.id)}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>
      <ServiceUsageNotes section="refresh" />
    </main>
  );
}

function SortLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg border px-3 py-2 text-sm font-bold transition ${
        active
          ? "border-lime-400 bg-lime-400 text-black"
          : "border-white/10 bg-white/[0.04] text-gray-300 hover:border-white/30 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}

function RefreshPlayerCard({
  player,
  season,
  ovrInfo,
  nearestRefresh,
  demandCount,
  observationHint,
}: {
  player: Player;
  season?: Season;
  ovrInfo?: PlayerOvrInfo | null;
  nearestRefresh?: NearestRefreshInfo | null;
  demandCount?: number;
  observationHint?: string;
}) {
  const imageUrl = `https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/playersAction/p${player.id}.png`;

  return (
    <Link
      href={`/refresh/${player.id}`}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-[#181b21] transition hover:-translate-y-1 hover:border-lime-400/50"
    >
      <div className="relative flex h-56 items-end justify-center overflow-hidden bg-gradient-to-b from-white/5 to-transparent">
        {season?.seasonImg && (
          <img
            src={season.seasonImg}
            alt={season.className}
            className="absolute left-4 top-4 h-7 object-contain"
          />
        )}

        <img
          src={imageUrl}
          alt={player.name}
          className="max-h-full object-contain transition duration-300 group-hover:scale-105"
        />
      </div>

      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-lime-400/10 px-2 py-1 text-xs font-bold text-lime-400">
            {season?.className ?? "시즌 미확인"}
          </span>
          {ovrInfo && (
            <span className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 text-xs font-bold text-gray-200">
              OVR {ovrInfo.ovr} · {ovrInfo.position}
            </span>
          )}
        </div>
        <h3 className="mt-3 text-lg font-bold">{player.name}</h3>
        {nearestRefresh ? (
          <p className="mt-2 text-sm font-semibold text-lime-300">
            다음 갱신 구간 시작 {nearestRefresh.label}
          </p>
        ) : observationHint ? (
          <p className="mt-2 text-sm font-semibold text-violet-200">
            {observationHint} · 상세에서 확인
          </p>
        ) : demandCount ? (
          <p className="mt-2 text-sm font-semibold text-amber-200">
            알림 요청 {demandCount}건 · 첫 제보 기다리는 중
          </p>
        ) : (
          <p className="mt-2 text-sm text-gray-500">갱신시간 확인하기 →</p>
        )}
      </div>
    </Link>
  );
}
