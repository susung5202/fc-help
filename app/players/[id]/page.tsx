import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerStats } from "@/lib/fconline/playerStats";

type Player = {
  id: number;
  name: string;
};

type Season = {
  seasonId: number;
  className: string;
  seasonImg: string;
};

const STAT_GROUPS = [
  "공격",
  "패스",
  "드리블",
  "수비",
  "피지컬",
  "골키퍼",
] as const;

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

function buildStatsHref(
  spid: number,
  strong: number,
  grow: number,
  teamColor: number
) {
  const params = new URLSearchParams({
    strong: String(strong),
    grow: String(grow),
    teamColor: String(teamColor),
  });

  return `/players/${spid}?${params.toString()}`;
}

function getStatTone(value: number) {
  if (value >= 150) {
    return "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-300";
  }

  if (value >= 140) {
    return "border-rose-400/40 bg-rose-400/10 text-rose-300";
  }

  if (value >= 130) {
    return "border-orange-400/40 bg-orange-400/10 text-orange-300";
  }

  if (value >= 120) {
    return "border-amber-300/40 bg-amber-300/10 text-amber-200";
  }

  if (value >= 110) {
    return "border-lime-400/40 bg-lime-400/10 text-lime-300";
  }

  if (value >= 100) {
    return "border-emerald-400/40 bg-emerald-400/10 text-emerald-300";
  }

  if (value >= 90) {
    return "border-cyan-400/40 bg-cyan-400/10 text-cyan-300";
  }

  return "border-white/10 bg-white/[0.04] text-gray-200";
}

export default async function PlayerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    strong?: string;
    grow?: string;
    teamColor?: string;
  }>;
}) {
  const { id } = await params;
  const {
    strong: strongParam = "1",
    grow: growParam = "1",
    teamColor: teamColorParam = "0",
  } = await searchParams;

  const spid = Number(id);

  if (!Number.isFinite(spid)) {
    notFound();
  }

  const parsedStrong = Number(strongParam);
  const strong = Number.isFinite(parsedStrong)
    ? Math.min(13, Math.max(1, Math.trunc(parsedStrong)))
    : 1;

  const grow = Number(growParam) === 5 ? 5 : 1;

  const parsedTeamColor = Number(teamColorParam);
  const teamColor = Number.isFinite(parsedTeamColor)
    ? Math.min(9, Math.max(0, Math.trunc(parsedTeamColor)))
    : 0;

  const [players, seasons, stats] = await Promise.all([
    getPlayers(),
    getSeasons(),
    getPlayerStats(spid, strong, grow),
  ]);

  const player = players.find((item) => item.id === spid);

  if (!player) {
    notFound();
  }

  const seasonId = Math.floor(spid / 1_000_000);
  const season = seasons.find(
    (item) => Number(item.seasonId) === seasonId
  );

  const seasonName = season?.className ?? "시즌 미확인";
  const playerImage = `https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/playersAction/p${spid}.png`;

  const adjustedAbilities = stats
    ? stats.abilities.map((stat) => ({
        ...stat,
        baseValue: stat.value,
        value: Math.min(200, stat.value + teamColor),
      }))
    : [];

  return (
    <main className="min-h-screen bg-[#0f1115] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-2xl font-extrabold tracking-tight">
            FC <span className="text-lime-400">Help</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-gray-300 md:flex">
            <Link href="/players" className="text-white">
              선수 DB
            </Link>
            <Link href="/refresh" className="transition hover:text-white">
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

      <section className="mx-auto max-w-7xl px-6 py-10">
        <Link
          href="/players"
          className="text-sm text-gray-400 transition hover:text-white"
        >
          ← 선수 DB로 돌아가기
        </Link>

        <div className="mt-8 grid gap-8 lg:grid-cols-[380px_1fr]">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#181b21]">
            <div className="relative flex h-[430px] items-end justify-center overflow-hidden bg-gradient-to-b from-white/10 to-transparent">
              {season?.seasonImg && (
                <img
                  src={season.seasonImg}
                  alt={seasonName}
                  className="absolute left-6 top-6 h-10 object-contain"
                />
              )}

              <img
                src={playerImage}
                alt={player.name}
                className="max-h-[390px] max-w-full object-contain"
              />
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <div>
              <span className="rounded-lg bg-lime-400/10 px-3 py-1.5 text-sm font-bold text-lime-400">
                {seasonName}
              </span>
            </div>

            <h1 className="mt-5 text-4xl font-extrabold md:text-5xl">
              {player.name}
            </h1>

            <p className="mt-4 max-w-xl text-gray-400">
              FC 온라인 공식 선수 데이터와 데이터센터 능력치를 기반으로
              제공합니다.
            </p>

            <div className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
              <span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                +{strong}강
              </span>
              <span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                적응도 {grow}
              </span>
              <span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                팀컬러 +{teamColor}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-white/10 bg-[#181b21] p-6 lg:col-span-3">
            <p className="text-sm font-semibold text-lime-400">PLAYER INFO</p>
            <h2 className="mt-1 text-2xl font-bold">선수 정보</h2>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <PlayerInfoBox title="선수명" value={player.name} />
              <PlayerInfoBox title="시즌" value={seasonName} />
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-2xl border border-white/10 bg-[#181b21] p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-lime-400">PLAYER STATS</p>
              <h2 className="mt-1 text-2xl font-bold">상세 능력치</h2>
              <p className="mt-2 text-sm text-gray-500">
                강화 +{strong} · 적응도 {grow} · 팀컬러 전체 능력치 +{teamColor}
              </p>
            </div>

            {stats && (
              <a
                href={stats.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-gray-400 transition hover:text-white"
              >
                공식 데이터센터 원본 ↗
              </a>
            )}
          </div>

          <div className="mt-7 grid gap-6 lg:grid-cols-3">
            <StatOptionSection title="강화">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {Array.from({ length: 13 }, (_, index) => index + 1).map(
                  (level) => (
                    <Link
                      key={level}
                      href={buildStatsHref(spid, level, grow, teamColor)}
                      className={`flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm font-bold transition ${
                        strong === level
                          ? "border-lime-400 bg-lime-400 text-black"
                          : "border-white/10 bg-white/[0.04] text-gray-400 hover:border-white/30 hover:text-white"
                      }`}
                    >
                      +{level}
                    </Link>
                  )
                )}
              </div>
            </StatOptionSection>

            <StatOptionSection title="적응도">
              <div className="flex gap-2">
                {[1, 5].map((level) => (
                  <Link
                    key={level}
                    href={buildStatsHref(spid, strong, level, teamColor)}
                    className={`flex h-10 min-w-16 items-center justify-center rounded-lg border px-4 text-sm font-bold transition ${
                      grow === level
                        ? "border-lime-400 bg-lime-400 text-black"
                        : "border-white/10 bg-white/[0.04] text-gray-400 hover:border-white/30 hover:text-white"
                    }`}
                  >
                    +{level}
                  </Link>
                ))}
              </div>
            </StatOptionSection>

            <StatOptionSection title="팀컬러">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {Array.from({ length: 10 }, (_, index) => index).map(
                  (bonus) => (
                    <Link
                      key={bonus}
                      href={buildStatsHref(spid, strong, grow, bonus)}
                      className={`flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm font-bold transition ${
                        teamColor === bonus
                          ? "border-lime-400 bg-lime-400 text-black"
                          : "border-white/10 bg-white/[0.04] text-gray-400 hover:border-white/30 hover:text-white"
                      }`}
                    >
                      +{bonus}
                    </Link>
                  )
                )}
              </div>
            </StatOptionSection>
          </div>

          <p className="mt-3 text-xs leading-5 text-gray-600">
            팀컬러는 현재 전체 능력치 보너스(+0~+9) 기준입니다. 특정 클럽/국가
            팀컬러의 추가 세부 능력치 효과는 별도 적용되지 않습니다.
          </p>

          {!stats ? (
            <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-10 text-center">
              <p className="font-semibold">능력치를 불러오지 못했습니다.</p>
              <p className="mt-2 text-sm text-gray-500">
                FC 온라인 데이터센터가 일시적으로 응답하지 않거나 페이지 구조가
                변경되었을 수 있습니다.
              </p>
              <a
                href={`https://fconline.nexon.com/DataCenter/PlayerInfo?n1Strong=${strong}&n1grow=${grow === 5 ? 4 : 0}&spid=${spid}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block text-sm font-semibold text-lime-400"
              >
                공식 데이터센터에서 확인 ↗
              </a>
            </div>
          ) : (
            <div className="mt-8 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {STAT_GROUPS.map((groupName) => {
                const groupStats = adjustedAbilities.filter(
                  (stat) => stat.group === groupName
                );

                if (groupStats.length === 0) {
                  return null;
                }

                return (
                  <div
                    key={groupName}
                    className="rounded-2xl border border-white/10 bg-[#12151a] p-5"
                  >
                    <h3 className="text-lg font-bold">{groupName}</h3>

                    <div className="mt-4 divide-y divide-white/5">
                      {groupStats.map((stat) => (
                        <div
                          key={stat.label}
                          className="flex items-center justify-between gap-4 py-2.5"
                        >
                          <span className="text-sm text-gray-400">
                            {stat.label}
                          </span>

                          <div className="flex items-center gap-2">
                            {teamColor > 0 && (
                              <span className="text-[11px] font-semibold text-lime-400/80">
                                {stat.baseValue}+{teamColor}
                              </span>
                            )}

                            <span
                              className={`min-w-14 rounded-lg border px-2.5 py-1 text-center text-lg font-extrabold ${getStatTone(
                                stat.value
                              )}`}
                            >
                              {stat.value}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </section>

      <footer className="mt-20 border-t border-white/10 px-6 py-8 text-center text-sm text-gray-500">
        FC Help · FC Online Data & Community
      </footer>
    </main>
  );
}

function StatOptionSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-gray-300">{title}</p>
      {children}
    </div>
  );
}

function PlayerInfoBox({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-white/[0.04] p-5">
      <p className="text-sm text-gray-500">{title}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  );
}
