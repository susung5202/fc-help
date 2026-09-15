import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerStats } from "@/lib/fconline/playerStats";
import { searchTeamColors } from "@/lib/fconline/teamColors";

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

function buildStatsHref({
  spid,
  strong,
  grow,
  teamQuery,
  teamPick,
}: {
  spid: number;
  strong: number;
  grow: number;
  teamQuery?: string;
  teamPick?: number | null;
}) {
  const params = new URLSearchParams({
    strong: String(strong),
    grow: String(grow),
  });

  if (teamQuery?.trim()) {
    params.set("teamQuery", teamQuery.trim());
  }

  if (teamPick !== null && teamPick !== undefined && teamPick >= 0) {
    params.set("teamPick", String(teamPick));
  }

  return `/players/${spid}?${params.toString()}`;
}

function getStatTextTone(value: number) {
  // 2026-07-30 업데이트 이후 170~179 구간은 160대와 별도 색상으로 분리됨.
  if (value >= 170) return "text-[#67d7ff]";
  if (value >= 160) return "text-[#61e7cb]";
  if (value >= 150) return "text-[#f2c86b]";
  if (value >= 140) return "text-[#ffb75d]";
  if (value >= 130) return "text-[#ff7b73]";
  if (value >= 120) return "text-[#c892ff]";
  if (value >= 110) return "text-[#85d96f]";
  if (value >= 100) return "text-[#67c9a5]";
  if (value >= 90) return "text-[#70b8e8]";
  return "text-gray-200";
}

export default async function PlayerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    strong?: string;
    grow?: string;
    teamQuery?: string;
    teamPick?: string;
  }>;
}) {
  const { id } = await params;
  const {
    strong: strongParam = "1",
    grow: growParam = "1",
    teamQuery: teamQueryParam = "",
    teamPick: teamPickParam,
  } = await searchParams;

  const spid = Number(id);
  if (!Number.isFinite(spid)) notFound();

  const parsedStrong = Number(strongParam);
  const strong = Number.isFinite(parsedStrong)
    ? Math.min(13, Math.max(1, Math.trunc(parsedStrong)))
    : 1;

  const grow = Number(growParam) === 5 ? 5 : 1;
  const teamQuery = teamQueryParam.trim().slice(0, 50);
  const parsedTeamPick = Number(teamPickParam);
  const teamPick = Number.isFinite(parsedTeamPick)
    ? Math.max(0, Math.trunc(parsedTeamPick))
    : null;

  const [players, seasons, stats, teamColorResults] = await Promise.all([
    getPlayers(),
    getSeasons(),
    getPlayerStats(spid, strong, grow),
    teamQuery ? searchTeamColors(teamQuery) : Promise.resolve([]),
  ]);

  const player = players.find((item) => item.id === spid);
  if (!player) notFound();

  const seasonId = Math.floor(spid / 1_000_000);
  const season = seasons.find(
    (item) => Number(item.seasonId) === seasonId
  );

  const seasonName = season?.className ?? "시즌 미확인";
  const playerImage = `https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/playersAction/p${spid}.png`;
  const selectedTeamColor =
    teamPick !== null ? teamColorResults[teamPick] ?? null : null;

  const teamEffectMap = new Map<string, number>();
  let overallTeamBonus = 0;

  for (const effect of selectedTeamColor?.effects ?? []) {
    if (effect.label === "전체 능력치") {
      overallTeamBonus += effect.value;
    } else {
      teamEffectMap.set(
        effect.label,
        (teamEffectMap.get(effect.label) ?? 0) + effect.value
      );
    }
  }

  const adjustedAbilities = stats
    ? stats.abilities.map((stat) => {
        const specificBonus = teamEffectMap.get(stat.label) ?? 0;
        const totalBonus = overallTeamBonus + specificBonus;
        return {
          ...stat,
          baseValue: stat.value,
          teamBonus: totalBonus,
          value: Math.min(200, stat.value + totalBonus),
        };
      })
    : [];

  return (
    <main className="min-h-screen bg-[#0f1115] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-2xl font-extrabold tracking-tight">
            FC <span className="text-lime-400">Help</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-gray-300 md:flex">
            <Link href="/players" className="text-white">선수 DB</Link>
            <Link href="/refresh" className="transition hover:text-white">갱신시간</Link>
            <Link href="/squad" className="transition hover:text-white">스쿼드</Link>
            <Link href="/community" className="transition hover:text-white">커뮤니티</Link>
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
        <Link href="/players" className="text-sm text-gray-400 transition hover:text-white">
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
            <h1 className="mt-5 text-4xl font-extrabold md:text-5xl">{player.name}</h1>
            <p className="mt-4 max-w-xl text-gray-400">
              FC 온라인 공식 선수 데이터와 데이터센터 능력치를 기반으로 제공합니다.
            </p>

            <div className="mt-6 flex flex-wrap gap-2 text-sm font-semibold">
              <span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">+{strong}강</span>
              <span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">적응도 {grow}</span>
              {selectedTeamColor && (
                <span className="rounded-lg border border-lime-400/30 bg-lime-400/10 px-3 py-2 text-lime-300">
                  {selectedTeamColor.name}
                </span>
              )}
            </div>
          </div>
        </div>

        <section className="mt-12 rounded-2xl border border-white/10 bg-[#181b21] p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-lime-400">PLAYER STATS</p>
              <h2 className="mt-1 text-2xl font-bold">상세 능력치</h2>
              <p className="mt-2 text-sm text-gray-500">
                강화 +{strong} · 적응도 {grow}
                {selectedTeamColor ? ` · ${selectedTeamColor.name} 적용` : " · 팀컬러 미적용"}
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

          <div className="mt-7 grid gap-6 lg:grid-cols-2">
            <StatOptionSection title="강화">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {Array.from({ length: 13 }, (_, index) => index + 1).map((level) => (
                  <Link
                    key={level}
                    href={buildStatsHref({
                      spid,
                      strong: level,
                      grow,
                      teamQuery,
                      teamPick,
                    })}
                    className={`flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm font-bold transition ${
                      strong === level
                        ? "border-lime-400 bg-lime-400 text-black"
                        : "border-white/10 bg-white/[0.04] text-gray-400 hover:border-white/30 hover:text-white"
                    }`}
                  >
                    +{level}
                  </Link>
                ))}
              </div>
            </StatOptionSection>

            <StatOptionSection title="적응도">
              <div className="flex gap-2">
                {[1, 5].map((level) => (
                  <Link
                    key={level}
                    href={buildStatsHref({
                      spid,
                      strong,
                      grow: level,
                      teamQuery,
                      teamPick,
                    })}
                    className={`flex h-10 min-w-16 items-center justify-center rounded-lg border px-4 text-sm font-bold transition ${
                      grow === level
                        ? "border-lime-400 bg-lime-400 text-black"
                        : "border-white/10 bg-white/[0.04] text-gray-400 hover:border-white/30 hover:text-white"
                    }`}
                  >
                    {level}
                  </Link>
                ))}
              </div>
            </StatOptionSection>
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-[#12151a] p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-300">개별 팀컬러</p>
                <p className="mt-1 text-xs text-gray-500">
                  FC 온라인 공식 데이터센터의 소속·특성·강화·관계·스페셜 팀컬러를 검색해서 적용합니다.
                </p>
              </div>
              {selectedTeamColor && (
                <Link
                  href={buildStatsHref({ spid, strong, grow })}
                  className="text-sm font-semibold text-gray-400 hover:text-white"
                >
                  팀컬러 해제
                </Link>
              )}
            </div>

            <form action={`/players/${spid}`} method="get" className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="strong" value={strong} />
              <input type="hidden" name="grow" value={grow} />
              <input
                type="text"
                name="teamQuery"
                defaultValue={teamQuery}
                placeholder="예: 레알 마드리드, 대한민국, 은빛 물결"
                className="h-11 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none placeholder:text-gray-600 focus:border-lime-400/60"
              />
              <button
                type="submit"
                className="h-11 rounded-xl bg-lime-400 px-5 text-sm font-extrabold text-black"
              >
                팀컬러 검색
              </button>
            </form>

            {teamQuery && (
              <div className="mt-5">
                {teamColorResults.length === 0 ? (
                  <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-gray-500">
                    검색된 팀컬러가 없습니다.
                  </p>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2">
                    {teamColorResults.map((teamColor, index) => {
                      const active = teamPick === index;
                      return (
                        <Link
                          key={`${teamColor.name}-${index}`}
                          href={buildStatsHref({
                            spid,
                            strong,
                            grow,
                            teamQuery,
                            teamPick: index,
                          })}
                          className={`rounded-xl border p-4 transition ${
                            active
                              ? "border-lime-400/60 bg-lime-400/10"
                              : "border-white/10 bg-white/[0.03] hover:border-white/25"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <p className="font-bold">{teamColor.name}</p>
                            <span className="shrink-0 text-xs text-gray-500">
                              {teamColor.level}단계 / 최고 {teamColor.maxLevel}
                            </span>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-gray-400">
                            {teamColor.effects
                              .map((effect) => `${effect.label} +${effect.value}`)
                              .join(" · ")}
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {!stats ? (
            <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-10 text-center">
              <p className="font-semibold">능력치를 불러오지 못했습니다.</p>
              <p className="mt-2 text-sm text-gray-500">
                FC 온라인 데이터센터 응답을 확인해주세요.
              </p>
            </div>
          ) : (
            <div className="mt-8 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
              {STAT_GROUPS.map((groupName) => {
                const groupStats = adjustedAbilities.filter((stat) => stat.group === groupName);
                if (groupStats.length === 0) return null;

                return (
                  <div key={groupName} className="rounded-2xl border border-white/10 bg-[#12151a] p-5">
                    <h3 className="text-lg font-bold">{groupName}</h3>
                    <div className="mt-4 divide-y divide-white/5">
                      {groupStats.map((stat) => (
                        <div key={stat.label} className="flex items-center justify-between gap-4 py-2.5">
                          <span className="text-sm text-gray-400">{stat.label}</span>
                          <div className="flex items-baseline gap-2">
                            {stat.teamBonus > 0 && (
                              <span className="text-[11px] font-semibold text-lime-400/80">
                                +{stat.teamBonus}
                              </span>
                            )}
                            <span className={`text-xl font-extrabold tabular-nums ${getStatTextTone(stat.value)}`}>
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
