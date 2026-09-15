import Link from "next/link";
import { notFound } from "next/navigation";
import RefreshAlertButton from "@/components/RefreshAlertButton";
import RefreshReportButton from "@/components/RefreshReportButton";
import RefreshReportSummary from "@/components/RefreshReportSummary";

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

export default async function RefreshDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const spid = Number(id);

  if (!Number.isFinite(spid)) {
    notFound();
  }

  const [players, seasons] = await Promise.all([
    getPlayers(),
    getSeasons(),
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

      <section className="mx-auto max-w-7xl px-6 py-10">
        <Link
          href="/refresh"
          className="text-sm text-gray-400 transition hover:text-white"
        >
          ← 갱신시간 검색으로 돌아가기
        </Link>

        <div className="mt-8 grid gap-8 lg:grid-cols-[320px_1fr]">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#181b21]">
            <div className="relative flex h-[360px] items-end justify-center overflow-hidden bg-gradient-to-b from-white/10 to-transparent">
              {season?.seasonImg && (
                <img
                  src={season.seasonImg}
                  alt={seasonName}
                  className="absolute left-6 top-6 h-9 object-contain"
                />
              )}

              <img
                src={playerImage}
                alt={player.name}
                className="max-h-[330px] max-w-full object-contain"
              />
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <p className="text-sm font-semibold text-lime-400">REFRESH TIME</p>
            <div className="mt-3">
              <span className="rounded-lg bg-lime-400/10 px-3 py-1.5 text-sm font-bold text-lime-400">
                {seasonName}
              </span>
            </div>

            <h1 className="mt-5 text-4xl font-extrabold md:text-5xl">
              {player.name}
            </h1>

            <p className="mt-4 max-w-xl text-gray-400">
              유저 제보를 기반으로 대표 갱신시간을 확인하고 알림을 설정할 수 있습니다.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <RefreshAlertButton
                playerSpid={player.id}
                playerName={player.name}
                seasonName={seasonName}
              />
              <RefreshReportButton
                playerSpid={player.id}
                playerName={player.name}
                seasonName={seasonName}
              />
            </div>
          </div>
        </div>

        <RefreshReportSummary playerSpid={player.id} />
      </section>

      <footer className="mt-20 border-t border-white/10 px-6 py-8 text-center text-sm text-gray-500">
        FC Help · FC Online Data & Community
      </footer>
    </main>
  );
}
