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

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
  }>;
}) {
  const { q = "" } = await searchParams;

  const query = q.trim();

  const [players, seasons] = await Promise.all([
    getPlayers(),
    getSeasons(),
  ]);

  const seasonMap = new Map(
    seasons.map((season) => [
      Number(season.seasonId),
      season,
    ])
  );

  const results = query
    ? players
        .filter((player) =>
          player.name
            .toLowerCase()
            .includes(query.toLowerCase())
        )
        .sort((a, b) => b.id - a.id)
        .slice(0, 100)
    : [];

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

        {/* 검색창 */}
        <form
          action="/players"
          method="GET"
          className="mt-10 flex max-w-3xl rounded-2xl border border-white/10 bg-[#181b21] p-2"
        >
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="선수 이름을 검색하세요"
            className="flex-1 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500"
          />

          <button
            type="submit"
            className="rounded-xl bg-lime-400 px-6 py-3 text-sm font-bold text-black transition hover:bg-lime-300"
          >
            검색
          </button>
        </form>

        {/* 검색 결과 */}
        <div className="mt-12">
          {!query ? (
            <div className="rounded-2xl border border-white/10 bg-[#181b21] px-6 py-16 text-center">
              <p className="text-lg font-semibold">
                원하는 선수를 검색해주세요.
              </p>

              <p className="mt-2 text-sm text-gray-500">
                선수 이름을 입력하면 시즌별 선수를 확인할 수 있습니다.
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
              <div className="mb-6 flex items-end justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    검색 결과
                  </p>

                  <h2 className="mt-1 text-2xl font-bold">
                    {query}
                  </h2>
                </div>

                <span className="text-sm text-gray-500">
                  {results.length}개
                </span>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {results.map((player) => {
                  const seasonId = Math.floor(
                    player.id / 1_000_000
                  );

                  const season =
                    seasonMap.get(seasonId);

                  return (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      season={season}
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

function PlayerCard({
  player,
  season,
}: {
  player: Player;
  season?: Season;
}) {
  const imageUrl =
    `https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/playersAction/p${player.id}.png`;

  return (
    <a
      href={`/players/${player.id}`}
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
        <span className="rounded-md bg-lime-400/10 px-2 py-1 text-xs font-bold text-lime-400">
          {season?.className ?? "시즌 미확인"}
        </span>

        <h3 className="mt-3 text-lg font-bold">
          {player.name}
        </h3>

        <p className="mt-2 text-xs text-gray-500">
          SPID {player.id}
        </p>
      </div>
    </a>
  );
}