"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/mypage", label: "프로필", exact: true },
  { href: "/mypage/activity", label: "내 활동" },
  { href: "/mypage/reports", label: "신고내역" },
  { href: "/mypage/settings", label: "계정 설정" },
] as const;

export default function MyPageNav() {
  const pathname = usePathname();

  return (
    <nav className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="마이페이지 메뉴">
      <div className="flex min-w-max gap-1 rounded-2xl border border-white/10 bg-[#15191d] p-1.5">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-xl px-4 py-2.5 text-xs font-black transition sm:px-5 sm:text-sm ${
                active
                  ? "bg-lime-300 text-black shadow-[0_0_22px_rgba(190,242,100,0.08)]"
                  : "text-gray-400 hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
