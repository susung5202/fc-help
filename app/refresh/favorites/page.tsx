import type { Metadata } from "next";
import Link from "next/link";
import { RefreshFavoritesProvider, RefreshFavoritesList } from "@/components/RefreshFavorites";

export const metadata: Metadata = {
  title: "갱신시간 즐겨찾기 | FC Help",
  description: "즐겨찾기한 FC 온라인 선수의 갱신시간을 한곳에서 확인하세요.",
  alternates: { canonical: "/refresh/favorites" },
};

export default function RefreshFavoritesPage() {
  return (
    <RefreshFavoritesProvider>
      <main className="min-h-screen bg-[#0f1115] text-white">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 sm:py-14">
          <Link href="/refresh" className="text-sm font-bold text-gray-400 hover:text-lime-300">
            ← 갱신시간 검색
          </Link>
          <div className="mt-8">
            <p className="text-xs font-black tracking-[0.16em] text-amber-300">MY FAVORITES</p>
            <h1 className="mt-2 text-3xl font-black">갱신시간 즐겨찾기</h1>
            <p className="mt-3 text-sm text-gray-400">즐겨찾기한 선수를 모아보고 갱신시간을 확인할 수 있습니다.</p>
          </div>
          <RefreshFavoritesList />
        </div>
      </main>
    </RefreshFavoritesProvider>
  );
}
