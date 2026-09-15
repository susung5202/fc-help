import Link from "next/link";
import { notFound } from "next/navigation";
import PlayerStatsPanel from "@/components/PlayerStatsPanel";
import { getPlayerStats } from "@/lib/fconline/playerStats";
import { getPlayerTeamColors } from "@/lib/fconline/teamColors";

type Player = {
  id: number;
  name: string;
};

type Season = {
  seasonId: number;
  className: string;
  seasonImg: string;
};

async function getPlayers(): Promise<Player[]> {
  const res = await fetch(
    "https://open.api.nexon.com/static/fconline/meta/spid.json",
    { next: { revalidate: 86400 } }
  );
  if (!res.ok) throw new Error("선수 데이터를 불러오지 못했습니다.");
  return res.json();
}

async function getSeasons(): Promise<Season[]> {
  const res = await fetch(
    "https://open.api.nexon.com/static/fconline/meta/seasonid.json",
    { next: { revalidate: 86400 } }
  );
  if (!res.ok) throw new Error("시즌 데이터를 불러오지 못했습니다.");
  return res.json();
}

function parseIndex(value?: string) {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

function getEnhancementBadgeTone(grade: number) {
  if (grade >= 13) return "border-lime-300/70 bg-lime-400/20 text-lime-200 shadow-[0_0_14px_rgba(163,230,53,0.18)]";
  if (grade === 12) return "border-fuchsia-300/60 bg-fuchsia-400/20 text-fuchsia-200";
  if (grade === 11) return "border-pink-300/60 bg-pink-400/20 text-pink-200";
  if (grade === 10) return "border-orange-300/60 bg-orange-400/20 text-orange-200";
  if (grade === 9) return "border-emerald-300/60 bg-emerald-400/20 text-emerald-200";
  if (grade === 8) return "border-cyan-300/60 bg-cyan-400/20 text-cyan-200";
  if (grade === 7) return "border-sky-300/60 bg-sky-400/20 text-sky-200";
  if (grade === 6) return "border-violet-300/60 bg-violet-400/20 text-violet-200";
  if (grade === 5) return "border-rose-300/60 bg-rose-400/20 text-rose-200";
  if (grade === 4) return "border-amber-300/60 bg-amber-400/20 text-amber-200";
  if (grade === 3) return "border-slate-200/50 bg-slate-200/15 text-slate-100";
  if (grade === 2) return "border-orange-700/70 bg-orange-800/30 text-orange-200";
  return "border-white/15 bg-white/10 text-gray-200";
}

export default async function PlayerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    strong?: string;
    grow?: string;
    tcR?: string;
    tcA?: string;
    tcF?: string;
  }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const spid = Number(id);
  if (!Number.isFinite(spid)) notFound();

  const parsedStrong = Number(query.strong ?? "1");
  const strong = Number.isFinite(parsedStrong)
    ? Math.min(13, Math.max(1, Math.trunc(parsedStrong)))
    : 1;
  const grow: 1 | 5 = Number(query.grow) === 5 ? 5 : 1;

  const reinforcementPick = parseIndex(query.tcR);
  const affiliationPick = parseIndex(query.tcA);
  const featurePick = parseIndex(query.tcF);

  const [players, seasons, stats, teamColors] = await Promise.all([
    getPlayers(),
    getSeasons(),
    getPlayerStats(spid, strong, grow),
    getPlayerTeamColors(spid, strong),
  ]);

  const player = players.find((item) => item.id === spid);
  if (!player) notFound();

  const seasonId = Math.floor(spid / 1_000_000);
  const season = seasons.find((item) => Number(item.seasonId) === seasonId);
  const seasonName = season?.className ?? "시즌 미확인";
  const playerImage = `https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/playersAction/p${spid}.png`;

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
        <Link
          href="/players"
          className="text-sm text-gray-400 transition hover:text-white"
        >
          ← 선수 DB로 돌아가기
        </Link>

        <div className="mt-8 grid gap-8 lg:grid-cols-[580px_1fr]">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#181b21]">
            <div className="relative flex h-[620px] items-end justify-center overflow-hidden bg-gradient-to-b from-white/10 to-transparent sm:h-[680px]">
              {season?.seasonImg && (
                <img
                  src={season.seasonImg}
                  alt={seasonName}
                  className="absolute left-6 top-6 z-10 h-16 object-contain"
                />
              )}
              <img
                src={playerImage}
                alt={player.name}
                className="max-h-[680px] max-w-[175%] origin-bottom translate-y-3 scale-[1.68] object-contain sm:scale-[1.78]"
              />
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-lime-400/10 px-3 py-1.5 text-sm font-bold text-lime-400">
                {seasonName}
              </span>
              <span
                className={`rounded-lg border px-3 py-1.5 text-sm font-black ${getEnhancementBadgeTone(strong)}`}
              >
                +{strong}
              </span>
            </div>
            <h1 className="mt-5 text-4xl font-extrabold md:text-5xl">
              {player.name}
            </h1>
            <p className="mt-4 max-w-xl text-gray-400">
              FC 온라인 공식 선수 데이터와 데이터센터 능력치를 기반으로 제공합니다.
            </p>
          </div>
        </div>

        <PlayerStatsPanel
          spid={spid}
          initialStrong={strong}
          initialGrow={grow}
          initialStats={stats}
          initialTeamColors={teamColors}
          initialReinforcementPick={reinforcementPick}
          initialAffiliationPick={affiliationPick}
          initialFeaturePick={featurePick}
        />
      </section>

      <footer className="mt-20 border-t border-white/10 px-6 py-8 text-center text-sm text-gray-500">
        FC Help · FC Online Data & Community
      </footer>
    </main>
  );
}
