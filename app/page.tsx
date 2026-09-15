import Link from "next/link";
import PushNotificationSetup from "@/components/PushNotificationSetup";

export default function HomePage() {
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
        <p className="text-sm font-semibold text-lime-400">FC ONLINE DATA & COMMUNITY</p>
        <h1 className="mt-2 text-4xl font-bold">FC Help</h1>
        <p className="mt-3 max-w-2xl text-gray-400">
          선수 정보는 선수 DB에서, 유저 제보 기반 갱신시간과 알림은 갱신시간 탭에서 확인하세요.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/players"
            className="rounded-xl bg-lime-400 px-5 py-3 text-sm font-bold text-black"
          >
            선수 DB 보기
          </Link>
          <Link
            href="/refresh"
            className="rounded-xl border border-white/10 bg-[#181b21] px-5 py-3 text-sm font-semibold text-white"
          >
            갱신시간 보기
          </Link>
        </div>

        <div className="mt-8">
          <PushNotificationSetup />
        </div>
      </section>
    </main>
  );
}
