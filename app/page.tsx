import PushNotificationSetup from "@/components/PushNotificationSetup";

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
    {
      next: {
        revalidate: 86400,
      },
    }
  );

  if (!res.ok) {
    throw new Error("선수 데이터를 불러오지 못했습니다.");
  }

  return res.json();
}

async function getSeasons(): Promise<Season[]> {
  const res = await fetch(
    "https://open.api.nexon.com/static/fconline/meta/seasonid.json",
    {
      next: {
        revalidate: 86400,
      },
    }
  );

  if (!res.ok) {
    throw new Error("시즌 데이터를 불러오지 못했습니다.");
  }

  return res.json();
}

export default async function PlayersPage() {
  const [players, seasons] = await Promise.all([
    getPlayers(),
    getSeasons(),
  ]);

  return (
    <main className="min-h-screen bg-[#0f1115] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a
            href="/players"
            className="text-2xl font-extrabold tracking-tight"
          >
            FC <span className="text-lime-400">Help</span>
          </a>

          <nav className="hidden items-center gap-8 text-sm text-gray-300 md:flex">
            <a
              href="/players"
              className="text-white"
            >
              선수 DB
            </a>

            <a
              href="#"
              className="transition hover:text-white"
            >
              갱신시간
            </a>

            <a
              href="#"
              className="transition hover:text-white"
            >
              스쿼드
            </a>

            <a
              href="#"
              className="transition hover:text-white"
            >
              커뮤니티
            </a>
          </nav>

          <button className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black">
            로그인
          </button>

          <div className="mt-6 flex justify-center">
            <PushNotificationSetup />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <p className="text-sm font-semibold text-lime-400">
          PLAYER DATABASE
        </p>

        <h1 className="mt-2 text-4xl font-bold">
          선수 DB
        </h1>

        <p className="mt-3 text-gray-400">
          FC 온라인 공식 데이터를 기반으로 선수를 검색합니다.
        </p>
      </section>
    </main>
  );
}