import Link from "next/link";
import PushNotificationSetup from "@/components/PushNotificationSetup";

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

export default function HomePage() {
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

function InfoRow({ number, text }: { number: string; text: string }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/[0.07] bg-black/10 px-4 py-3.5">
      <span className="text-[10px] font-black text-lime-400/70">{number}</span>
      <span className="text-xs font-bold text-gray-300 sm:text-sm">{text}</span>
    </div>
  );
}
