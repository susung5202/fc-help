import Link from "next/link";
import AccountButton from "@/components/AccountButton";

export default function SiteHeader() {
  return (
    <header data-site-header className="border-b border-[#23324d] bg-[#07101d]/95 text-white backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="FC Help 홈" className="group flex shrink-0 items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center border border-[#3f75ff] bg-[#0b1a31] text-xs font-black text-[#78a0ff] transition group-hover:bg-[#102444]">
            FH
          </span>
          <span className="hidden sm:block">
            <span className="block text-sm font-black tracking-[0.14em] text-white">FC HELP</span>
            <span className="mt-0.5 block text-[8px] font-black tracking-[0.22em] text-[#536b90]">PLAYER CONTROL DESK</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 text-xs font-black md:flex">
          <HeaderLink href="/players">선수 DB</HeaderLink>
          <HeaderLink href="/refresh">갱신시간</HeaderLink>
          <HeaderLink href="/squad">스쿼드</HeaderLink>
          <HeaderLink href="/community">커뮤니티</HeaderLink>
        </nav>

        <AccountButton />
      </div>
    </header>
  );
}

function HeaderLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="border border-transparent px-3 py-2.5 text-[#8292aa] transition hover:border-[#23324d] hover:bg-[#0b1829] hover:text-white"
    >
      {children}
    </Link>
  );
}
