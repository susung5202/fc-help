import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-white/10 bg-[#0b0d10] text-gray-400">
      <div className="mx-auto w-full max-w-7xl px-5 py-9 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-12">
          <div className="max-w-2xl">
            <Link href="/" className="inline-flex items-center text-lg font-black tracking-tight text-white">
              FC <span className="ml-1 text-lime-400">Help</span>
            </Link>
            <p className="mt-3 text-sm leading-6 text-gray-400">
              FC 온라인 이용자를 위한 선수 정보 및 스쿼드 관리 도구입니다.
              선수 DB, 가격 갱신 시간, 스쿼드 메이커 등 게임 이용에 필요한 정보를
              한곳에서 편리하게 확인할 수 있습니다.
            </p>
            <p className="mt-3 text-xs leading-5 text-gray-500">
              FC Help는 FC 온라인을 즐기는 이용자를 위해 제작된 비공식 팬 사이트이며,
              NEXON 및 EA와 공식적인 제휴 관계가 없습니다.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 md:text-right">
            <nav aria-label="FC Help 서비스">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                Services
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold md:max-w-[260px] md:justify-end">
                <Link href="/players" className="text-gray-300 transition hover:text-lime-300">
                  선수 DB
                </Link>
                <Link href="/refresh" className="text-gray-300 transition hover:text-lime-300">
                  갱신시간
                </Link>
                <Link href="/squad" className="text-gray-300 transition hover:text-lime-300">
                  스쿼드 메이커
                </Link>
              </div>
            </nav>

            <nav aria-label="FC Help 지원">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                Support
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold md:justify-end">
                <Link href="/contact" className="text-gray-300 transition hover:text-lime-300">
                  문의
                </Link>
                <Link href="/privacy" className="text-gray-300 transition hover:text-lime-300">
                  개인정보처리방침
                </Link>
              </div>
            </nav>
          </div>
        </div>

        <div className="mt-8 border-t border-white/[0.08] pt-5 text-[11px] leading-5 text-gray-600 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <p>© 2026 FC Help. All rights reserved.</p>
          <p className="mt-1 sm:mt-0">비공식 FC 온라인 팬 서비스</p>
        </div>
      </div>
    </footer>
  );
}
