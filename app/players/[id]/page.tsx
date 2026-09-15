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

export default async function PlayerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ strong?: string }>;
}) {
  const { id } = await params;
  const { strong: strongParam = "1" } = await searchParams;
  const spid = Number(id);

  if (!Number.isFinite(spid)) {
    notFound();
  }

  const parsedStrong = Number(strongParam);
  const strong = Number.isFinite(parsedStrong)
    ? Math.min(13, Math.max(1, Math.trunc(parsedStrong)))
    : 1;

  const [players, seasons, stats] = await Promise.all([
    getPlayers(),
    getSeasons(),
    getPlayerStats(spid, strong),
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

  const summaryStats = stats
    ? [
        ["스피드", stats.summary.speed],
        ["슛", stats.summary.shooting],
        ["패스", stats.summary.passing],
        ["드리블", stats.summary.dribbling],
        ["수비", stats.summary.defending],
        ["피지컬", stats.summary.physical],
      ]
    : [];

  const hasSummaryStats = summaryStats.some(([, value]) => value !== null);

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

            {stats && hasSummaryStats && (
              <div className="mt-8 grid grid-cols-3 gap-3 sm:grid-cols-6">
                {summaryStats.map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-4 text-center"
                  >
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="mt-1 text-2xl font-extrabold text-lime-400">
                      {value ?? "-"}
                    </p>
                  </div>
                ))}
              </div>
            )}
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
                FC 온라인 데이터센터 기준 · 강화 적용 · 적응도 1 · 팀컬러 미적용
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

          <div className="mt-6">
            <p className="mb-3 text-sm font-semibold text-gray-300">강화 단계</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {Array.from({ length: 13 }, (_, index) => index + 1).map(
                (level) => (
                  <Link
                    key={level}
                    href={`/players/${spid}?strong=${level}`}
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
          </div>

          {!stats ? (
            <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-10 text-center">
              <p className="font-semibold">능력치를 불러오지 못했습니다.</p>
              <p className="mt-2 text-sm text-gray-500">
                FC 온라인 데이터센터가 일시적으로 응답하지 않거나 페이지 구조가
                변경되었을 수 있습니다.
              </p>
              <a
                href={`https://fconline.nexon.com/DataCenter/PlayerInfo?n1Strong=${strong}&spid=${spid}`}
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
                const groupStats = stats.abilities.filter(
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
                          className="flex items-center justify-between py-2.5"
                        >
                          <span className="text-sm text-gray-400">
                            {stat.label}
                          </span>
                          <span className="text-lg font-extrabold text-white">
                            {stat.value}
                          </span>
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
