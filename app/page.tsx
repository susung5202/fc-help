import Link from "next/link";
import PlayerArtwork from "@/components/PlayerArtwork";
import PushNotificationSetup from "@/components/PushNotificationSetup";
import { getPlayerRankings, type PlayerRankingItem } from "@/lib/fconline/playerRankings";
import { createAdminClient } from "@/lib/supabase/admin";

export const revalidate = 60;

const QUICK_LINKS = [
  {
    href: "/players",
    number: "01",
    title: "선수 DB",
    description: "선수 검색 · 시즌 · OVR · 공식경기 데이터",
    accent: "text-lime-300",
  },
  {
    href: "/refresh",
    number: "02",
    title: "갱신시간",
    description: "유저 제보 기반 갱신시간 · 브라우저 알림",
    accent: "text-cyan-300",
  },
  {
    href: "/squad",
    number: "03",
    title: "스쿼드",
    description: "스쿼드 제작 · 공유 · 다른 구단주 스쿼드 탐색",
    accent: "text-violet-300",
  },
  {
    href: "/community",
    number: "04",
    title: "커뮤니티",
    description: "자유 · 질문 · 팁 · 스쿼드 이야기",
    accent: "text-amber-300",
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
  return date.toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
  });
}

function refreshTimeText(report: RefreshReport) {
  const hour = report.hour_type === "odd" ? "홀수시" : report.hour_type === "even" ? "짝수시" : report.hour_type;
  return `${hour} ${String(report.refresh_minute).padStart(2, "0")}분`;
}

export default async function HomePage() {
  const { popularPlayers, refreshReports, squads, communityPosts } = await loadLobbyData();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0f1115] text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[720px] opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 18% 10%, rgba(163,230,53,0.20), transparent 32%), radial-gradient(circle at 82% 22%, rgba(34,211,238,0.10), transparent 28%), linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "auto, auto, 42px 42px, 42px 42px",
        }}
      />

      <section className="relative mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6 sm:pb-16 sm:pt-20 lg:pt-24">
        <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-lime-300/15 bg-lime-300/[0.06] px-3 py-1.5 text-[10px] font-black tracking-[0.18em] text-lime-300 sm:text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-lime-300 shadow-[0_0_14px_rgba(190,242,100,0.9)]" />
              FC ONLINE DATA HUB
            </div>

            <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[1.05] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              찾는 시간은 줄이고,
              <br />
              <span className="text-lime-300">플레이에 집중하세요.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-sm leading-7 text-gray-400 sm:text-base sm:leading-8">
              FC Help에서 선수 정보, 갱신시간, 스쿼드 제작과 커뮤니티를 한 번에 이용하세요.
              필요한 정보까지 가장 짧은 동선을 목표로 만듭니다.
            </p>

            <form
              action="/players"
              method="GET"
              className="mt-8 flex max-w-2xl items-center rounded-2xl border border-white/10 bg-[#171b20]/90 p-2 shadow-2xl shadow-black/20 backdrop-blur"
            >
              <div className="hidden pl-3 pr-1 text-gray-500 sm:block" aria-hidden="true">
                ⌕
              </div>
              <input
                type="text"
                name="q"
                placeholder="선수 이름을 검색하세요"
                className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm font-semibold text-white outline-none placeholder:font-medium placeholder:text-gray-600 sm:px-4 sm:py-4"
              />
              <button
                type="submit"
                className="shrink-0 rounded-xl bg-lime-300 px-4 py-3 text-xs font-black text-black transition hover:bg-lime-200 sm:px-6 sm:py-4 sm:text-sm"
              >
                선수 검색
              </button>
            </form>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-bold text-gray-600 sm:text-xs">
              <span>✓ FC Online 공식 데이터 기반</span>
              <span>✓ 갱신시간 유저 제보</span>
              <span>✓ 모바일 지원</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-12 -z-10 rounded-full bg-lime-300/[0.04] blur-3xl" />
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#14181c]/90 shadow-2xl shadow-black/30 backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 sm:px-6">
                <div>
                  <p className="text-[9px] font-black tracking-[0.22em] text-gray-600">FC HELP</p>
                  <p className="mt-1 text-sm font-black text-gray-200">QUICK ACCESS</p>
                </div>
                <span className="rounded-full border border-lime-300/15 bg-lime-300/[0.05] px-3 py-1 text-[10px] font-black text-lime-300">
                  ONLINE
                </span>
              </div>

              <div className="grid grid-cols-2">
                {QUICK_LINKS.map((item, index) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group min-h-40 p-5 transition hover:bg-white/[0.04] sm:min-h-44 sm:p-6 ${
                      index % 2 === 0 ? "border-r border-white/[0.07]" : ""
                    } ${index < 2 ? "border-b border-white/[0.07]" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-black tracking-[0.15em] ${item.accent}`}>
                        {item.number}
                      </span>
                      <span className="text-sm text-gray-700 transition group-hover:translate-x-1 group-hover:text-gray-300">
                        →
                      </span>
                    </div>
                    <h2 className="mt-7 text-lg font-black tracking-tight sm:text-xl">{item.title}</h2>
                    <p className="mt-2 text-[11px] leading-5 text-gray-600 sm:text-xs sm:leading-5">
                      {item.description}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] text-lime-400">START HERE</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">FC Help, 이렇게 쓰면 됩니다</h2>
          </div>
          <p className="max-w-md text-xs leading-5 text-gray-600 sm:text-sm sm:leading-6">
            검색부터 알림, 스쿼드 공유까지 자주 쓰는 기능을 메인에서 바로 시작할 수 있습니다.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FeatureCard
            href="/players"
            eyebrow="PLAYER"
            title="선수를 찾는다"
            description="이름으로 검색하고 시즌별 선수 정보와 공식경기 데이터를 확인하세요."
            action="선수 DB 열기"
          />
          <FeatureCard
            href="/refresh"
            eyebrow="REFRESH"
            title="갱신을 기다린다"
            description="유저들이 제보한 갱신시간을 확인하고 원하는 선수의 알림을 설정하세요."
            action="갱신시간 확인"
          />
          <FeatureCard
            href="/squad"
            eyebrow="SQUAD"
            title="스쿼드를 만든다"
            description="내 스쿼드를 구성하고 저장한 뒤 다른 구단주에게 공유해보세요."
            action="스쿼드 만들기"
          />
          <FeatureCard
            href="/community"
            eyebrow="COMMUNITY"
            title="정보를 나눈다"
            description="질문, 팁, 자유 이야기와 스쿼드 피드백을 다른 유저들과 나눠보세요."
            action="커뮤니티 가기"
          />
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black tracking-[0.2em] text-cyan-300">UPDATED DATA</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">지금 FC Help에서는</h2>
          </div>
          <p className="max-w-md text-xs leading-5 text-gray-600 sm:text-sm sm:leading-6">
            FC Online 공식 데이터와 FC Help에 실제로 쌓인 최신 데이터를 보여줍니다.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <LobbyPanel
            eyebrow="PLAYER RANKING"
            title="최근 인기 선수"
            href="/players"
            action="선수 DB 전체 보기"
          >
            {popularPlayers.length > 0 ? (
              <div className="divide-y divide-white/[0.07]">
                {popularPlayers.slice(0, 5).map((player, index) => (
                  <PopularPlayerRow key={`${player.spid}-${player.grade}`} player={player} rank={index + 1} />
                ))}
              </div>
            ) : (
              <EmptyState text="FC Online 인기 선수 데이터를 불러오지 못했습니다." />
            )}
          </LobbyPanel>

          <LobbyPanel
            eyebrow="REFRESH REPORT"
            title="최근 갱신 제보"
            href="/refresh"
            action="갱신시간 전체 보기"
          >
            {refreshReports.length > 0 ? (
              <div className="divide-y divide-white/[0.07]">
                {refreshReports.map((report) => (
                  <Link
                    key={report.id}
                    href="/refresh"
                    className="flex items-center gap-4 px-5 py-4 transition hover:bg-white/[0.03] sm:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-black text-gray-100">{report.player_name}</span>
                        <span className="shrink-0 rounded-md border border-cyan-300/15 bg-cyan-300/[0.05] px-2 py-0.5 text-[9px] font-black text-cyan-200">
                          {refreshTimeText(report)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-gray-600">{report.season_name}</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold text-gray-700">{formatDate(report.created_at)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState text="아직 등록된 갱신 제보가 없습니다." />
            )}
          </LobbyPanel>

          <LobbyPanel
            eyebrow="SQUAD GALLERY"
            title="인기 스쿼드"
            href="/squad/gallery"
            action="스쿼드 갤러리 보기"
          >
            {squads.length > 0 ? (
              <div className="divide-y divide-white/[0.07]">
                {squads.map((squad, index) => (
                  <Link
                    key={squad.id}
                    href={`/squad/gallery/${squad.id}`}
                    className="flex items-center gap-4 px-5 py-4 transition hover:bg-white/[0.03] sm:px-6"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-violet-300/15 bg-violet-300/[0.05] text-[10px] font-black text-violet-200">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-gray-100">{squad.title}</p>
                      <p className="mt-1 truncate text-[11px] text-gray-600">
                        {squad.author_name} · {squad.formation || "포메이션 미지정"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-[10px] font-bold text-gray-600">
                      <p>♥ {Number(squad.likes_count || 0).toLocaleString("ko-KR")}</p>
                      <p className="mt-1">조회 {Number(squad.views || 0).toLocaleString("ko-KR")}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState text="아직 공개된 스쿼드가 없습니다." />
            )}
          </LobbyPanel>

          <LobbyPanel
            eyebrow="COMMUNITY"
            title="최신 커뮤니티"
            href="/community"
            action="커뮤니티 전체 보기"
          >
            {communityPosts.length > 0 ? (
              <div className="divide-y divide-white/[0.07]">
                {communityPosts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/community/${post.id}`}
                    className="flex items-center gap-4 px-5 py-4 transition hover:bg-white/[0.03] sm:px-6"
                  >
                    <span className="shrink-0 rounded-md border border-amber-300/15 bg-amber-300/[0.05] px-2 py-1 text-[9px] font-black text-amber-200">
                      {CATEGORY_LABEL[post.category] ?? post.category}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-black text-gray-100">{post.title}</p>
                    <span className="shrink-0 text-[10px] font-bold text-gray-700">{formatDate(post.created_at)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                <p className="text-sm font-black text-gray-300">아직 작성된 커뮤니티 글이 없습니다.</p>
                <p className="mt-2 text-xs text-gray-600">첫 글을 작성해서 FC Help 커뮤니티를 시작해보세요.</p>
                <Link
                  href="/community/write"
                  className="mt-5 rounded-xl bg-amber-300 px-4 py-2.5 text-xs font-black text-black transition hover:bg-amber-200"
                >
                  첫 글 작성하기
                </Link>
              </div>
            )}
          </LobbyPanel>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pb-24 sm:pt-10">
        <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#192118] via-[#151a18] to-[#13171b] p-6 sm:p-8">
            <div className="flex h-full min-h-72 flex-col justify-between">
              <div>
                <p className="text-[10px] font-black tracking-[0.2em] text-lime-300">REFRESH ALERT</p>
                <h2 className="mt-3 max-w-lg text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                  갱신시간을 계속
                  <br />
                  보고 있을 필요는 없습니다.
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-6 text-gray-500">
                  브라우저 알림을 켜두면 등록한 선수의 갱신시간을 놓치지 않도록 FC Help가 알려줍니다.
                </p>
              </div>

              <div className="mt-8">
                <PushNotificationSetup />
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-[#15191d] p-6 sm:p-8">
            <p className="text-[10px] font-black tracking-[0.2em] text-gray-600">FC HELP</p>
            <h2 className="mt-3 text-2xl font-black tracking-tight">하나의 계정으로 이어지는 기능</h2>
            <p className="mt-3 text-sm leading-6 text-gray-500">
              FC Online 닉네임을 연동하면 프로필, 스쿼드, 커뮤니티 활동과 알림을 한 계정에서 관리할 수 있습니다.
            </p>

            <div className="mt-8 space-y-3">
              <InfoRow number="01" text="FC Online 닉네임 · OUID 연동" />
              <InfoRow number="02" text="내 스쿼드 저장 및 갤러리 공유" />
              <InfoRow number="03" text="댓글 · 좋아요 · 신고 처리 알림" />
              <InfoRow number="04" text="내 활동과 계정 설정 한 곳에서 관리" />
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              <Link
                href="/mypage"
                className="rounded-xl bg-white px-4 py-2.5 text-xs font-black text-black transition hover:bg-gray-200"
              >
                마이페이지
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-black text-gray-300 transition hover:bg-white/[0.04] hover:text-white"
              >
                로그인 / 회원가입
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({
  href,
  eyebrow,
  title,
  description,
  action,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
  action: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-64 flex-col rounded-3xl border border-white/10 bg-[#15191d] p-5 transition duration-300 hover:-translate-y-1 hover:border-lime-300/20 hover:bg-[#181d20] sm:p-6"
    >
      <p className="text-[9px] font-black tracking-[0.2em] text-gray-600 transition group-hover:text-lime-400">
        {eyebrow}
      </p>
      <h3 className="mt-5 text-xl font-black tracking-tight">{title}</h3>
      <p className="mt-3 text-xs leading-6 text-gray-500">{description}</p>
      <div className="mt-auto flex items-center justify-between pt-8 text-xs font-black text-gray-400">
        <span>{action}</span>
        <span className="transition group-hover:translate-x-1 group-hover:text-lime-300">→</span>
      </div>
    </Link>
  );
}

function LobbyPanel({
  eyebrow,
  title,
  href,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  href: string;
  action: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#15191d]">
      <div className="flex items-end justify-between gap-4 border-b border-white/[0.08] px-5 py-5 sm:px-6">
        <div>
          <p className="text-[9px] font-black tracking-[0.2em] text-gray-600">{eyebrow}</p>
          <h3 className="mt-1 text-xl font-black tracking-tight">{title}</h3>
        </div>
        <Link href={href} className="shrink-0 text-[10px] font-black text-gray-500 transition hover:text-white">
          {action} →
        </Link>
      </div>
      {children}
    </section>
  );
}

function PopularPlayerRow({ player, rank }: { player: PlayerRankingItem; rank: number }) {
  return (
    <Link
      href={`/players/${player.spid}`}
      className="group flex items-center gap-3 px-5 py-3.5 transition hover:bg-white/[0.03] sm:px-6"
    >
      <span className={`w-5 text-center text-xs font-black ${rank === 1 ? "text-lime-300" : "text-gray-600"}`}>
        {rank}
      </span>
      <div className="flex h-12 w-12 shrink-0 items-end justify-center overflow-hidden rounded-xl bg-black/20">
        <PlayerArtwork
          spid={player.spid}
          alt={player.name}
          className="h-14 w-auto max-w-none object-contain transition group-hover:scale-105"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-gray-100">{player.name}</p>
        <p className="mt-1 text-[10px] font-bold text-gray-600">+{player.grade} 강화 · 전일 공식경기</p>
      </div>
      <span className="shrink-0 rounded-lg border border-lime-300/10 bg-lime-300/[0.04] px-2.5 py-1.5 text-[10px] font-black text-lime-200">
        {Number(player.metric).toLocaleString("ko-KR")}회
      </span>
    </Link>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-64 items-center justify-center px-6 text-center text-sm font-bold text-gray-600">
      {text}
    </div>
  );
}

function InfoRow({ number, text }: { number: string; text: string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/[0.07] bg-black/10 px-4 py-3.5">
      <span className="text-[10px] font-black text-lime-400/70">{number}</span>
      <span className="text-xs font-bold text-gray-300 sm:text-sm">{text}</span>
    </div>
  );
}
