"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/mypage", label: "프로필", exact: true },
  { href: "/mypage/activity", label: "내 활동", exact: false },
  { href: "/mypage/reports", label: "신고내역", exact: false },
  { href: "/mypage/settings", label: "계정 설정", exact: false },
] as const;

export default function MyPageNav() {
  const pathname = usePathname();

  return (
    <nav className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="마이페이지 메뉴">
      <div className="flex min-w-max gap-1 border border-[#23324d] bg-[#0b1728] p-1.5">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`border px-4 py-2.5 text-xs font-black transition sm:px-5 sm:text-sm ${
                active
                  ? "border-[#3f75ff] bg-[#173465] text-[#a9beff]"
                  : "border-transparent text-[#7d8da6] hover:border-[#2a3d5d] hover:bg-[#0e1d31] hover:text-white"
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
