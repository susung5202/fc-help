import Link from "next/link";
import SquadMaker from "@/components/SquadMaker";
import SquadShareButton from "@/components/SquadShareButton";

export default function SquadPage() {
  return (
    <main className="min-h-screen bg-[#0f1115] text-white">
      <header className="hidden border-b border-white/10 md:block">
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
            <Link href="/squad/gallery" className="transition hover:text-white">
              스쿼드 갤러리
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

      <section className="mx-auto max-w-7xl px-0 py-0 md:px-6 md:py-14">
        <div className="hidden md:block">
          <p className="text-sm font-semibold text-lime-400">SQUAD MAKER</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
            스쿼드 메이커
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400 sm:text-base">
            포메이션을 고르고 포지션별 선수를 배치해 나만의 FC 온라인 스쿼드를 구성할 수 있습니다.
            현재 스쿼드는 이 기기에 자동 저장됩니다.
          </p>
        </div>

        <div className="flex gap-2 px-2 pt-2 md:mt-6 md:px-0 md:pt-0">
          <Link href="/squad/gallery" className="flex-1 rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3 text-center text-sm font-black text-gray-200 transition hover:bg-white/[0.07] md:flex-none">
            스쿼드 갤러리
          </Link>
          <SquadShareButton />
        </div>

        <SquadMaker />
      </section>

      <footer className="mt-14 hidden border-t border-white/10 px-6 py-8 text-center text-sm text-gray-500 md:block">
        FC Help · Data based on NEXON Open API
      </footer>
    </main>
  );
}
