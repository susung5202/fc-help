import Link from "next/link";
import SquadMaker from "@/components/SquadMaker";

export default function SquadPage() {
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
            <Link href="/squad" className="text-white">
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

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-sm font-semibold text-lime-400">SQUAD MAKER</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
          스쿼드 메이커
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400 sm:text-base">
          포메이션을 고르고 포지션별 선수를 배치해 나만의 FC 온라인 스쿼드를 구성할 수 있습니다.
          현재 스쿼드는 이 기기에 자동 저장됩니다.
        </p>

        <SquadMaker />
      </section>

      <footer className="mt-14 border-t border-white/10 px-6 py-8 text-center text-sm text-gray-500">
        FC Help · Data based on NEXON Open API
      </footer>
    </main>
  );
}
