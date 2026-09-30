import Link from "next/link";
import PlayerArtwork from "@/components/PlayerArtwork";
import PushNotificationSetup from "@/components/PushNotificationSetup";
import { getPlayerRankings, type PlayerRankingItem } from "@/lib/fconline/playerRankings";
import { createAdminClient } from "@/lib/supabase/admin";

export const revalidate = 60;

const SERVICES = [
  {
    href: "/players",
    code: "01",
    title: "PLAYER DB",
    label: "선수 DB",
    description: "시즌 · OVR · 공식경기 데이터",
  },
  {
    href: "/refresh",
    code: "02",
    title: "REFRESH",
    label: "갱신시간",
    description: "유저 제보 · 갱신 알림",
  },
  {
    href: "/squad",
    code: "03",
    title: "SQUAD LAB",
    label: "스쿼드",
    description: "제작 · 저장 · 갤러리",
  },
  {
    href: "/community",
    code: "04",
    title: "LOUNGE",
    label: "커뮤니티",
    description: "질문 · 팁 · 자유 · 피드백",
  },
] as const;

type RefreshReport = {
  id: number;
  player_spid: number;
  player_name: string;
  season_name: string;
  hour_type: string;
  refresh_minute: number;
  observed_at: string;
  created_at: string;
};

type SquadPost = {
  id: string;
  author_name: string;
  title: string;
  formation: string;
  likes_count: number;
  comments_count: number;
  views: number;
  created_at: string;
};

type CommunityPost = {
  id: string;
  category: string;
  title: string;
  created_at: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  free: "자유",
  question: "질문",
  tip: "팁·정보",
  squad: "스쿼드",
};

async function loadLobbyData() {
  const supabase = createAdminClient();

  const [rankings, refreshResult, squadResult, communityResult] = await Promise.all([
    getPlayerRankings(),
    supabase
      .from("refresh_reports")
      .select("id,player_spid,player_name,season_name,hour_type,refresh_minute,observed_at,created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("squad_posts")
      .select("id,author_name,title,formation,likes_count,comments_count,views,created_at")
      .eq("is_public", true)
      .order("likes_count", { ascending: false })
      .order("views", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("community_posts")
      .select("id,category,title,created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (refreshResult.error) console.error("Failed to load refresh lobby data", refreshResult.error);
  if (squadResult.error) console.error("Failed to load squad lobby data", squadResult.error);
  if (communityResult.error) console.error("Failed to load community lobby data", communityResult.error);

  return {
    popularPlayers: rankings.popular,
    refreshReports: (refreshResult.data ?? []) as RefreshReport[],
    squads: (squadResult.data ?? []) as SquadPost[],
    communityPosts: (communityResult.data ?? []) as CommunityPost[],
  };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}

function refreshTimeText(report: RefreshReport) {
  const hour = report.hour_type === "odd" ? "홀수시" : report.hour_type === "even" ? "짝수시" : report.hour_type;
  return `${hour} ${String(report.refresh_minute).padStart(2, "0")}분`;
}

export default async function HomePage() {
  const { popularPlayers, refreshReports, squads, communityPosts } = await loadLobbyData();

  return (
    <main className="min-h-screen overflow-hidden bg-[#08111f] text-[#f5f7fb]">
      <section className="relative border-b border-[#23324d]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "linear-gradient(120deg, rgba(58,111,255,0.12), transparent 42%), linear-gradient(rgba(116,145,196,0.055) 1px, transparent 1px)",
            backgroundSize: "auto, 100% 64px",
          }}
        />

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.2fr_0.8fr] lg:gap-0 lg:py-20">
          <div className="lg:border-r lg:border-[#23324d] lg:pr-14">
            <div className="flex items-center gap-3 text-[10px] font-black tracking-[0.24em] text-[#7fa6ff] sm:text-xs">
              <span className="h-px w-10 bg-[#3f75ff]" />
              FC HELP / CONTROL DESK
            </div>

            <h1 className="mt-7 max-w-4xl text-4xl font-black leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-[72px]">
              선수부터 스쿼드까지,
              <br />
              <span className="text-[#6f98ff]">한 화면에서 컨트롤.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-sm leading-7 text-[#8795ad] sm:text-base sm:leading-8">
              FC Online 데이터를 찾고, 갱신시간을 확인하고, 스쿼드를 만들고, 다른 구단주와 정보를 나누는 곳.
              FC Help는 필요한 기능을 빠르게 연결하는 플레이어 도구함입니다.
            </p>

            <form action="/players" method="GET" className="mt-9 max-w-2xl border border-[#2b3c5c] bg-[#0b1728]">
              <div className="flex items-stretch">
                <div className="hidden w-14 items-center justify-center border-r border-[#2b3c5c] text-xs font-black text-[#58719a] sm:flex">
                  P
                </div>
                <input
                  type="text"
                  name="q"
                  placeholder="선수 이름을 입력하세요"
                  className="min-w-0 flex-1 bg-transparent px-4 py-4 text-sm font-bold text-white outline-none placeholder:font-medium placeholder:text-[#53637d] sm:px-5 sm:py-5"
                />
                <button
                  type="submit"
                  className="shrink-0 bg-[#3f75ff] px-5 text-xs font-black text-white transition hover:bg-[#5b88ff] sm:px-7 sm:text-sm"
                >
                  SEARCH →
                </button>
              </div>
            </form>

            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[10px] font-bold tracking-wide text-[#586984] sm:text-xs">
              <span>OFFICIAL PLAYER DATA</span>
              <span>USER REFRESH REPORTS</span>
              <span>RESPONSIVE WEB</span>
            </div>
          </div>

          <div className="lg:pl-10">
            <div className="mb-4 flex items-center justify-between border-b border-[#23324d] pb-3">
              <div>
                <p className="text-[9px] font-black tracking-[0.24em] text-[#58719a]">NAVIGATION</p>
                <p className="mt-1 text-sm font-black">SERVICE ROUTES</p>
              </div>
              <span className="text-[10px] font-black text-[#6f98ff]">04 MODULES</span>
            </div>

            <div className="divide-y divide-[#1f2d45] border-y border-[#23324d]">
              {SERVICES.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group grid grid-cols-[44px_1fr_auto] items-center gap-3 py-5 transition hover:bg-[#0d1c30] sm:grid-cols-[56px_1fr_auto] sm:py-6"
                >
                  <span className="text-[10px] font-black text-[#486182]">{item.code}</span>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-3">
                      <p className="text-sm font-black text-white sm:text-base">{item.label}</p>
                      <span className="hidden text-[9px] font-black tracking-[0.18em] text-[#486182] sm:inline">{item.title}</span>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-[#687b99]">{item.description}</p>
                  </div>
                  <span className="text-sm font-black text-[#3f75ff] transition group-hover:translate-x-1">↗</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#23324d] bg-[#0a1525]">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y divide-[#23324d] border-x border-[#23324d] sm:grid-cols-4 sm:divide-y-0">
          {SERVICES.map((item) => (
            <Link key={item.href} href={item.href} className="group p-4 transition hover:bg-[#0e1e33] sm:p-5">
              <p className="text-[9px] font-black tracking-[0.2em] text-[#516a8e]">{item.title}</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-sm font-black text-[#dce5f6]">{item.label}</span>
                <span className="text-xs text-[#3f75ff] transition group-hover:translate-x-1">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-[#23324d] pb-5">
          <div>
            <p className="text-[10px] font-black tracking-[0.24em] text-[#6f98ff]">LIVE BOARD / 01</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">업데이트 데이터</h2>
          </div>
          <p className="max-w-md text-xs leading-5 text-[#657693] sm:text-sm sm:leading-6">
            FC Online 공식 데이터와 FC Help에 실제로 쌓인 정보를 같은 보드에서 확인합니다.
          </p>
        </div>

        <div className="grid border border-[#23324d] lg:grid-cols-[1.15fr_0.85fr]">
          <section className="border-b border-[#23324d] lg:border-b-0 lg:border-r">
            <PanelHeader code="A01" title="최근 인기 선수" href="/players" action="PLAYER DB" />
            {popularPlayers.length > 0 ? (
              <div className="divide-y divide-[#1e2c43]">
                {popularPlayers.slice(0, 5).map((player, index) => (
                  <PopularPlayerRow key={`${player.spid}-${player.grade}`} player={player} rank={index + 1} />
                ))}
              </div>
            ) : (
              <EmptyState text="FC Online 인기 선수 데이터를 불러오지 못했습니다." />
            )}
          </section>

          <div className="grid sm:grid-cols-2 lg:grid-cols-1">
            <section className="border-b border-[#23324d] sm:border-r lg:border-r-0">
              <PanelHeader code="B01" title="최근 갱신 제보" href="/refresh" action="REFRESH" compact />
              {refreshReports.length > 0 ? (
                <div className="divide-y divide-[#1e2c43]">
                  {refreshReports.slice(0, 3).map((report) => (
                    <Link key={report.id} href="/refresh" className="flex items-center gap-3 px-4 py-4 transition hover:bg-[#0d1b2e] sm:px-5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black text-[#eef3fb] sm:text-sm">{report.player_name}</p>
                        <p className="mt-1 truncate text-[10px] text-[#5f7290]">{report.season_name}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[10px] font-black text-[#67d5ff]">{refreshTimeText(report)}</p>
                        <p className="mt-1 text-[9px] text-[#4f607a]">{formatDate(report.created_at)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState text="아직 등록된 갱신 제보가 없습니다." compact />
              )}
            </section>

            <section>
              <PanelHeader code="B02" title="인기 스쿼드" href="/squad/gallery" action="SQUAD" compact />
              {squads.length > 0 ? (
                <div className="divide-y divide-[#1e2c43]">
                  {squads.slice(0, 3).map((squad, index) => (
                    <Link key={squad.id} href={`/squad/gallery/${squad.id}`} className="grid grid-cols-[24px_1fr_auto] items-center gap-3 px-4 py-4 transition hover:bg-[#0d1b2e] sm:px-5">
                      <span className="text-[10px] font-black text-[#6f98ff]">0{index + 1}</span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-[#eef3fb] sm:text-sm">{squad.title}</p>
                        <p className="mt-1 truncate text-[10px] text-[#5f7290]">{squad.author_name} · {squad.formation || "미지정"}</p>
                      </div>
                      <span className="text-[9px] font-bold text-[#53647e]">♥ {Number(squad.likes_count || 0).toLocaleString("ko-KR")}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState text="아직 공개된 스쿼드가 없습니다." compact />
              )}
            </section>
          </div>
        </div>

        <div className="mt-5 grid border border-[#23324d] lg:grid-cols-[0.9fr_1.1fr]">
          <section className="border-b border-[#23324d] lg:border-b-0 lg:border-r">
            <PanelHeader code="C01" title="최신 커뮤니티" href="/community" action="LOUNGE" />
            {communityPosts.length > 0 ? (
              <div className="divide-y divide-[#1e2c43]">
                {communityPosts.map((post) => (
                  <Link key={post.id} href={`/community/${post.id}`} className="flex items-center gap-3 px-5 py-4 transition hover:bg-[#0d1b2e]">
                    <span className="w-14 shrink-0 text-[9px] font-black tracking-wide text-[#6f98ff]">{CATEGORY_LABEL[post.category] ?? post.category}</span>
                    <p className="min-w-0 flex-1 truncate text-sm font-black text-[#e7eef9]">{post.title}</p>
                    <span className="text-[9px] font-bold text-[#50617b]">{formatDate(post.created_at)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex min-h-56 flex-col justify-center px-6 py-8">
                <p className="text-sm font-black text-[#d8e1f0]">아직 작성된 글이 없습니다.</p>
                <p className="mt-2 text-xs text-[#60718c]">첫 글을 작성해서 FC Help 라운지를 시작해보세요.</p>
                <Link href="/community/write" className="mt-5 w-fit border border-[#3f75ff] bg-[#3f75ff] px-4 py-2.5 text-xs font-black text-white transition hover:bg-[#5b88ff]">
                  WRITE FIRST POST →
                </Link>
              </div>
            )}
          </section>

          <section className="bg-[#0a1729] p-5 sm:p-7">
            <div className="grid h-full gap-6 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <p className="text-[10px] font-black tracking-[0.22em] text-[#67d5ff]">SIGNAL / REFRESH ALERT</p>
                <h3 className="mt-3 text-2xl font-black tracking-[-0.03em] sm:text-3xl">갱신시간은 직접 지켜보지 않아도 됩니다.</h3>
                <p className="mt-3 max-w-2xl text-xs leading-6 text-[#687b98] sm:text-sm">
                  브라우저 알림을 켜두면 등록한 선수의 갱신 타이밍을 FC Help가 알려줍니다.
                </p>
              </div>
              <div className="sm:min-w-64">
                <PushNotificationSetup />
              </div>
            </div>
          </section>
        </div>
      </section>

      <section className="border-y border-[#23324d] bg-[#0a1525]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-[10px] font-black tracking-[0.22em] text-[#6f98ff]">ACCOUNT LINK / 02</p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.03em] sm:text-3xl">한 계정에서 플레이 기록을 이어가세요.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#687b98]">
              FC Online 닉네임 연동, 스쿼드 저장, 커뮤니티 활동, 알림과 신고 처리까지 마이페이지에서 관리합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/mypage" className="border border-[#3f75ff] bg-[#3f75ff] px-5 py-3 text-xs font-black text-white transition hover:bg-[#5b88ff]">
              MY PAGE →
            </Link>
            <Link href="/login" className="border border-[#2c3d5e] px-5 py-3 text-xs font-black text-[#b4c2d8] transition hover:border-[#4f6f9f] hover:text-white">
              LOGIN / JOIN
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function PanelHeader({
  code,
  title,
  href,
  action,
  compact = false,
}: {
  code: string;
  title: string;
  href: string;
  action: string;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-end justify-between gap-4 border-b border-[#23324d] ${compact ? "px-4 py-4 sm:px-5" : "px-5 py-5 sm:px-6"}`}>
      <div>
        <p className="text-[9px] font-black tracking-[0.2em] text-[#4e6688]">{code}</p>
        <h3 className={`mt-1 font-black tracking-[-0.02em] ${compact ? "text-base" : "text-xl"}`}>{title}</h3>
      </div>
      <Link href={href} className="shrink-0 text-[9px] font-black tracking-[0.12em] text-[#6f98ff] transition hover:text-[#9db8ff]">
        {action} ↗
      </Link>
    </div>
  );
}

function PopularPlayerRow({ player, rank }: { player: PlayerRankingItem; rank: number }) {
  return (
    <Link href={`/players/${player.spid}`} className="group grid grid-cols-[32px_56px_1fr_auto] items-center gap-3 px-5 py-4 transition hover:bg-[#0d1b2e] sm:grid-cols-[42px_64px_1fr_auto] sm:px-6">
      <span className={`text-sm font-black ${rank === 1 ? "text-[#6f98ff]" : "text-[#51627c]"}`}>{String(rank).padStart(2, "0")}</span>
      <div className="flex h-14 w-14 items-end justify-center overflow-hidden border border-[#23324d] bg-[#0a1627] sm:h-16 sm:w-16">
        <PlayerArtwork spid={player.spid} alt={player.name} className="h-16 w-auto max-w-none object-contain transition group-hover:scale-105 sm:h-18" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-[#eef3fb] sm:text-base">{player.name}</p>
        <p className="mt-1 text-[10px] font-bold text-[#5c6e8a]">+{player.grade} 강화 · 전일 공식경기</p>
      </div>
      <div className="text-right">
        <p className="text-xs font-black text-[#67d5ff] sm:text-sm">{Number(player.metric).toLocaleString("ko-KR")}</p>
        <p className="mt-1 text-[9px] font-bold text-[#4e607b]">MATCHES</p>
      </div>
    </Link>
  );
}

function EmptyState({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div className={`flex items-center justify-center px-6 text-center text-xs font-bold text-[#596b86] ${compact ? "min-h-40" : "min-h-56"}`}>
      {text}
    </div>
  );
}
