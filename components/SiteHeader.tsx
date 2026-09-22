import Link from "next/link";
import AccountButton from "@/components/AccountButton";

export default function SiteHeader() {
  return (
    <header
      data-site-header
      className="border-b border-white/10 bg-[#0f1115] text-white"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" aria-label="FC Help 홈" className="shrink-0">
          <img
            src="/fc-help-header.webp"
            alt="FC Help"
            width={423}
            height={120}
            className="h-10 w-auto sm:h-11"
          />
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

        <AccountButton />
      </div>
    </header>
  );
}
