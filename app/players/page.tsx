import Link from "next/link";
import {
  getPlayerRankings,
  type PlayerRankingItem,
} from "@/lib/fconline/playerRankings";

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

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();

  const [players, seasons, rankings] = await Promise.all([
    getPlayers(),
    getSeasons(),
    query ? Promise.resolve(null) : getPlayerRankings(),
  ]);

  const seasonMap = new Map(
    seasons.map((season) => [Number(season.seasonId), season])
  );
  const playerMap = new Map(players.map((player) => [player.id, player]));

  const results = query
    ? players
        .filter((player) =>
          player.name.toLowerCase().includes(query.toLowerCase())
        )
        .sort((a, b) => b.id - a.id)
        .slice(0, 100)
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

      <section className="mx-auto max-w-7xl px-6 py-16">
        <p className="text-sm font-semibold text-lime-400">PLAYER DATABASE</p>
        <h1 className="mt-2 text-4xl font-bold">선수 DB</h1>
        <p className="mt-3 text-gray-400">
          FC 온라인 공식 데이터를 기반으로 선수 정보와 최근 공식경기 통계를 확인합니다.
        </p>

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

        <div className="mt-12">
          {!query ? (
            <div className="grid gap-6 xl:grid-cols-3">
              <RankingBlock
                title="최근 인기 선수"
                description="전일 상위 1만 랭커 공식경기 출전 수 기준"
                items={rankings?.popular ?? []}
                playerMap={playerMap}
                seasonMap={seasonMap}
                metricLabel={(item) => `전일 ${item.metric}회 출전`}
              />
              <RankingBlock
                title="최고 평점 선수"
                description="전일 상위 1만 랭커 공식경기 평점 기준"
                items={rankings?.rating ?? []}
                playerMap={playerMap}
                seasonMap={seasonMap}
                metricLabel={(item) => `평균 평점 ${item.metric.toFixed(2)}`}
              />
              <RankingBlock
                title="강화 인기 선수"
                description="전일 +8 이상 이적시장 거래 선수 기준"
                items={rankings?.grade ?? []}
                playerMap={playerMap}
                seasonMap={seasonMap}
                metricLabel={(item) => `+${item.grade} 강화 거래`}
              />
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
                  <p className="text-sm text-gray-500">검색 결과</p>
                  <h2 className="mt-1 text-2xl font-bold">{query}</h2>
                </div>
                <span className="text-sm text-gray-500">{results.length}개</span>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {results.map((player) => {
                  const seasonId = Math.floor(player.id / 1_000_000);
                  const season = seasonMap.get(seasonId);

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

function RankingBlock({
  title,
  description,
  items,
  playerMap,
  seasonMap,
  metricLabel,
}: {
  title: string;
  description: string;
  items: PlayerRankingItem[];
  playerMap: Map<number, Player>;
  seasonMap: Map<number, Season>;
  metricLabel: (item: PlayerRankingItem) => string;
}) {
  const resolved = items
    .map((item) => {
      const player = playerMap.get(item.spid) ?? {
        id: item.spid,
        name: item.name,
      };
      const season = seasonMap.get(Math.floor(item.spid / 1_000_000));
      return { item, player, season };
    })
    .filter(
      (
        row
      ): row is {
        item: PlayerRankingItem;
        player: Player;
        season: Season | undefined;
      } => Boolean(row)
    );

  const first = resolved[0];

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#181b21] shadow-2xl shadow-black/10">
      <div className="border-b border-white/10 px-6 py-5">
        <h2 className="text-xl font-extrabold">{title}</h2>
        <p className="mt-1 text-xs text-gray-500">{description}</p>
      </div>

      {!first ? (
        <div className="flex min-h-[520px] items-center justify-center px-6 text-center">
          <div>
            <p className="font-semibold text-gray-300">공식 데이터를 불러오지 못했습니다.</p>
            <p className="mt-2 text-sm text-gray-500">
              FC온라인 데이터센터가 일시적으로 응답하지 않습니다.
            </p>
          </div>
        </div>
      ) : (
        <>
          <Link
            href={`/players/${first.player.id}`}
            className="group block overflow-hidden border-b border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent"
          >
            <div className="flex items-center justify-between gap-3 px-6 pt-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400 text-sm font-black text-black">
                1
              </span>
              <span className="rounded-full border border-lime-400/20 bg-lime-400/10 px-3 py-1 text-xs font-bold text-lime-300">
                {metricLabel(first.item)}
              </span>
            </div>

            <div className="relative mt-1 flex h-[340px] items-end justify-center overflow-hidden px-4 sm:h-[360px]">
              <object
                data={`https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/playersAction/p${first.player.id}.png`}
                type="image/png"
                aria-label={first.player.name}
                className="max-h-[380px] max-w-[155%] origin-bottom translate-y-1 scale-[1.56] object-contain transition duration-300 group-hover:scale-[1.62]"
              >
                <img
                  src={`https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/players/p${first.player.id}.png`}
                  alt={first.player.name}
                  className="max-h-[380px] max-w-[155%] origin-bottom object-contain"
                />
              </object>
            </div>

            <div className="relative border-t border-white/[0.06] bg-[#181b21]/95 px-6 pb-6 pt-5">
              <div className="flex min-w-0 items-center gap-3">
                {first.season?.seasonImg && (
                  <div className="flex h-10 w-12 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
                    <img
                      src={first.season.seasonImg}
                      alt={first.season.className}
                      className="max-h-8 max-w-10 object-contain"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-xs font-semibold text-gray-400">
                      {first.season?.className ?? "시즌 미확인"}
                    </span>
                    <span className="shrink-0 rounded-md bg-white/10 px-2 py-1 text-xs font-black text-white">
                      +{first.item.grade}
                    </span>
                  </div>
                  <h3 className="mt-2 truncate text-2xl font-black tracking-tight">
                    {first.player.name}
                  </h3>
                </div>
              </div>

              <div className="mt-5 flex items-end justify-between border-t border-white/10 pt-4">
                <span className="text-xs font-semibold text-gray-500">가격</span>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-300">
                    {first.item.price ?? "가격 정보 없음"}
                  </p>
                  {!first.item.price && (
                    <p className="mt-0.5 text-[11px] text-gray-600">
                      공식 가격 데이터 미제공
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Link>

          <div className="divide-y divide-white/[0.07]">
            {resolved.slice(1, 5).map(({ item, player, season }, index) => (
              <Link
                key={`${player.id}-${item.grade}`}
                href={`/players/${player.id}`}
                className="flex items-center gap-3 px-5 py-4 transition hover:bg-white/[0.04]"
              >
                <span className="w-6 text-center text-sm font-black text-gray-500">
                  {index + 2}
                </span>
                <div className="flex h-9 w-12 items-center justify-center">
                  {season?.seasonImg ? (
                    <img
                      src={season.seasonImg}
                      alt={season.className}
                      className="max-h-8 max-w-12 object-contain"
                    />
                  ) : (
                    <span className="text-[10px] text-gray-600">-</span>
                  )}
                </div>
                <span className="min-w-0 flex-1 truncate text-sm font-bold">
                  {player.name}
                </span>
                <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-black text-gray-200">
                  +{item.grade}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function PlayerCard({
  player,
  season,
}: {
  player: Player;
  season?: Season;
}) {
  const imageUrl = `https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/playersAction/p${player.id}.png`;

  return (
    <Link
      href={`/players/${player.id}`}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-[#181b21] transition hover:-translate-y-1 hover:border-lime-400/50"
    >
      <div className="relative flex h-[340px] items-end justify-center overflow-hidden bg-gradient-to-b from-white/5 to-transparent sm:h-[370px]">
        {season?.seasonImg && (
          <img
            src={season.seasonImg}
            alt={season.className}
            className="absolute left-4 top-4 z-10 h-11 object-contain"
          />
        )}

        <img
          src={imageUrl}
          alt={player.name}
          className="max-h-[370px] max-w-[170%] origin-bottom translate-y-2 scale-[1.7] object-contain transition duration-300 group-hover:scale-[1.78]"
        />
      </div>

      <div className="p-5">
        <span className="rounded-md bg-lime-400/10 px-2 py-1 text-xs font-bold text-lime-400">
          {season?.className ?? "시즌 미확인"}
        </span>
        <h3 className="mt-3 text-lg font-bold">{player.name}</h3>
      </div>
    </Link>
  );
}
