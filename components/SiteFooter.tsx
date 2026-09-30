import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-[#23324d] bg-[#060d18] text-[#71829d]">
      <div className="mx-auto w-full max-w-7xl px-5 py-9 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-12">
          <div className="max-w-2xl">
            <Link href="/" className="inline-flex items-center gap-3 text-white">
              <span className="flex h-8 w-8 items-center justify-center border border-[#3f75ff] bg-[#0b1a31] text-[10px] font-black text-[#7fa6ff]">FH</span>
              <span>
                <span className="block text-sm font-black tracking-[0.16em]">FC HELP</span>
                <span className="mt-0.5 block text-[8px] font-black tracking-[0.2em] text-[#4f6587]">PLAYER CONTROL DESK</span>
              </span>
            </Link>
            <p className="mt-4 text-sm leading-6 text-[#7587a3]">
              FC 온라인 이용자를 위한 선수 정보, 갱신시간, 스쿼드 제작 및 커뮤니티 도구를 한곳에서 제공합니다.
            </p>
            <p className="mt-3 text-xs leading-5 text-[#52637d]">
              FC Help는 비공식 팬 서비스이며 NEXON 및 EA와 공식적인 제휴 관계가 없습니다.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 md:text-right">
            <nav aria-label="FC Help 서비스">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4d6385]">Services</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold md:max-w-[280px] md:justify-end">
                <FooterLink href="/players">선수 DB</FooterLink>
                <FooterLink href="/refresh">갱신시간</FooterLink>
                <FooterLink href="/squad">스쿼드</FooterLink>
                <FooterLink href="/community">커뮤니티</FooterLink>
              </div>
            </nav>

            <nav aria-label="FC Help 지원">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#4d6385]">Support</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-bold md:justify-end">
                <FooterLink href="/contact">문의</FooterLink>
                <FooterLink href="/privacy">개인정보처리방침</FooterLink>
                <FooterLink href="/terms">이용약관</FooterLink>
              </div>
            </nav>
          </div>
        </div>

        <div className="mt-8 border-t border-[#1b2940] pt-5 text-[11px] leading-5 text-[#475975] sm:flex sm:items-center sm:justify-between sm:gap-4">
          <p>© 2026 FC Help. All rights reserved.</p>
          <p className="mt-1 sm:mt-0">UNOFFICIAL FC ONLINE FAN SERVICE</p>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-[#93a4bc] transition hover:text-[#7fa6ff]">
      {children}
    </Link>
  );
}
