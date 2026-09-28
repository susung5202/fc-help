import Link from "next/link";
import PublicProfile from "@/components/PublicProfile";

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;

  return (
    <main className="min-h-screen bg-[#0f1115] text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-xl font-extrabold tracking-tight sm:text-2xl">
            FC <span className="text-lime-400">Help</span>
          </Link>
          <Link href="/squad/gallery" className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-300 hover:bg-white/5 sm:text-sm">
            스쿼드 갤러리
          </Link>
        </div>
      </header>
      <PublicProfile username={username} />
    </main>
  );
}
