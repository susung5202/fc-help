import Link from "next/link";
import { getPlayerOvrMap, type PlayerOvrInfo } from "@/lib/fconline/playerOvr";
import { createAdminClient } from "@/lib/supabase/admin";

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
    const { data, error } = await supabase
      .from("refresh_reports")
      .select("player_spid, hour_type, refresh_minute")
      .in("player_spid", spids);

    if (error) {
      console.error("갱신시간 정렬용 제보 조회 실패", error.message);
      return result;
    }

    const grouped = new Map<number, RefreshReportRow[]>();
    for (const row of (data ?? []) as RefreshReportRow[]) {
      const spid = Number(row.player_spid);
      if (!Number.isFinite(spid)) continue;
      const rows = grouped.get(spid) ?? [];
      rows.push(row);
      grouped.set(spid, rows);
    }

    const now = new Date();

    for (const spid of spids) {
      const rows = (grouped.get(spid) ?? []).filter(
        (row) => row.hour_type !== "unknown" && row.refresh_minute !== null
      );

      if (rows.length === 0) {
        result.set(spid, null);
        continue;
      }

      const counts = new Map<string, { hourType: HourType; minute: number; count: number }>();
      for (const row of rows) {
        if (row.refresh_minute === null) continue;
        const key = `${row.hour_type}-${row.refresh_minute}`;
        const current = counts.get(key);
        if (current) {
          current.count += 1;
        } else {
          counts.set(key, {
            hourType: row.hour_type,
            minute: row.refresh_minute,
            count: 1,
          });
        }
      }

      const distribution = Array.from(counts.values()).sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.minute - b.minute;
      });
      const topCount = distribution[0]?.count ?? 0;
      const topCandidates = distribution.filter((item) => item.count === topCount);

      if (topCandidates.length !== 1) {
        result.set(spid, null);
        continue;
      }

      const winner = topCandidates[0];
      result.set(
        spid,
        getNextRefreshInfo(winner.hourType, winner.minute, now)
      );
    }
  } catch (error) {
    console.error("갱신시간 정렬 계산 실패", error);
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

  const [players, seasons] = await Promise.all([
    getPlayers(),
    getSeasons(),
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

  const [ovrMap, nearestRefreshMap] = await Promise.all([
    query && sortMode === "ovr"
      ? getPlayerOvrMap(matchedPlayers.map((player) => player.id))
      : Promise.resolve(new Map<number, PlayerOvrInfo | null>()),
    query && sortMode === "nearest"
      ? getNearestRefreshMap(matchedPlayers.map((player) => player.id))
      : Promise.resolve(new Map<number, NearestRefreshInfo | null>()),
  ]);

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
          선수별 유저 제보 갱신시간을 검색하고 알림을 설정할 수 있습니다.
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
            <div className="rounded-2xl border border-white/10 bg-[#181b21] px-6 py-16 text-center">
              <p className="text-lg font-semibold">갱신시간을 확인할 선수를 검색해주세요.</p>
              <p className="mt-2 text-sm text-gray-500">
                검색 후 시즌을 선택하면 제보된 갱신시간과 알림 설정을 확인할 수 있습니다.
              </p>
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
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>
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
}: {
  player: Player;
  season?: Season;
  ovrInfo?: PlayerOvrInfo | null;
  nearestRefresh?: NearestRefreshInfo | null;
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
            다음 예상 갱신 {nearestRefresh.label}
          </p>
        ) : (
          <p className="mt-2 text-sm text-gray-500">갱신시간 확인하기 →</p>
        )}
      </div>
    </Link>
  );
}
