"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "홈" },
  { href: "/players", label: "선수 DB" },
  { href: "/refresh", label: "갱신시간" },
  { href: "/squad", label: "스쿼드" },
  { href: "/squad/gallery", label: "갤러리" },
] as const;

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-[60] border-t border-white/10 bg-[#111318]/95 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
        {ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : item.href === "/squad"
                ? pathname === "/squad"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-11 items-center justify-center rounded-xl px-1 text-center text-[11px] font-bold transition sm:px-2 sm:text-xs ${
                active
                  ? "bg-lime-400/15 text-lime-300"
                  : "text-gray-400 active:bg-white/5 active:text-white"
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
