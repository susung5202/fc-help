import Link from "next/link";
import { notFound } from "next/navigation";
import PlayerArtwork from "@/components/PlayerArtwork";
import PlayerStatsPanel from "@/components/PlayerStatsPanel";
import { getPlayerStats } from "@/lib/fconline/playerStats";
import { getPlayerTeamColors } from "@/lib/fconline/teamColors";
import { getEnhancementBadgeTone } from "@/lib/ui/enhancementBadge";

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

      <section className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-10">
        <Link
          href="/players"
          className="text-sm text-gray-400 transition hover:text-white"
        >
          ← 선수 DB로 돌아가기
        </Link>

        <div className="mt-4 grid grid-cols-[108px_minmax(0,1fr)] gap-4 md:mt-8 md:grid-cols-1 md:gap-8 lg:grid-cols-[580px_1fr]">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#181b21] md:rounded-3xl">
            <div className="relative flex h-36 items-end justify-center overflow-hidden bg-gradient-to-b from-white/10 to-transparent md:h-[620px] lg:h-[680px]">
              {season?.seasonImg && (
                <img
                  src={season.seasonImg}
                  alt={seasonName}
                  className="absolute left-2 top-2 z-10 h-5 object-contain md:left-6 md:top-6 md:h-16"
                />
              )}
              <PlayerArtwork
                key={spid}
                spid={spid}
                alt={player.name}
                className="h-[85%] w-auto max-w-none shrink-0 object-contain object-bottom"
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-col justify-center">
            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
              <span className="rounded-md bg-lime-400/10 px-2 py-1 text-xs font-bold text-lime-400 md:rounded-lg md:px-3 md:py-1.5 md:text-sm">
                {seasonName}
              </span>
              <span
                className={`rounded-md border px-2 py-1 text-xs font-black md:rounded-lg md:px-3 md:py-1.5 md:text-sm ${getEnhancementBadgeTone(strong)}`}
              >
                +{strong}
              </span>
            </div>
            <h1 className="mt-2 break-words text-xl font-extrabold leading-tight md:mt-5 md:text-5xl">
              {player.name}
            </h1>
            <p className="mt-4 hidden max-w-xl text-gray-400 md:block">
              FC 온라인 공식 선수 데이터와 데이터센터 능력치를 기반으로 제공합니다.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 md:hidden">
              <a href="#player-abilities" className="rounded-lg bg-lime-400 px-3 py-2 text-xs font-bold text-black">
                능력치 바로보기 ↓
              </a>
              <a href="#player-options" className="rounded-lg border border-white/20 px-3 py-2 text-xs font-bold text-white">
                강화·적응도
              </a>
            </div>
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
