import Link from "next/link";
import SquadGallery from "@/components/SquadGallery";

export const metadata = {
  title: "스쿼드 갤러리 | FC Help",
  description: "FC 온라인 유저 스쿼드를 공유하고 검색하고 복사할 수 있는 FC Help 스쿼드 갤러리입니다.",
};

export default function SquadGalleryPage() {
  return (
    <main className="min-h-screen bg-[#0f1115] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-xl font-extrabold tracking-tight sm:text-2xl">
            FC <span className="text-lime-400">Help</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/squad" className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-300 hover:bg-white/5 sm:text-sm">
              스쿼드 메이커
            </Link>
            <Link href="/login" className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-black sm:text-sm">
              로그인
            </Link>
          </div>
        </div>
      </header>
      <SquadGallery />
    </main>
  );
}
