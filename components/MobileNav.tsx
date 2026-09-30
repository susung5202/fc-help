"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "홈" },
  { href: "/players", label: "선수 DB" },
  { href: "/refresh", label: "갱신시간" },
  { href: "/squad", label: "스쿼드" },
  { href: "/community", label: "커뮤니티" },
] as const;

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[60] border-t border-[#23324d] bg-[#07101d]/95 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
        {ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-11 items-center justify-center border px-1 text-center text-[10px] font-black transition ${
                active
                  ? "border-[#3f75ff] bg-[#10264a] text-[#8eacff]"
                  : "border-transparent text-[#72839d] active:border-[#23324d] active:bg-[#0b1829] active:text-white"
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
