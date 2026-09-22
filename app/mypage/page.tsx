"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type MySquad = {
  id: string;
  title: string;
  formation: string;
  total_value: string | number;
  views: number;
  likes_count: number;
  comments_count: number;
  created_at: string;
};

type MyComment = {
  id: number;
  post_id: string;
  content: string;
  likes_count: number;
  created_at: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MyPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [squads, setSquads] = useState<MySquad[]>([]);
  const [comments, setComments] = useState<MyComment[]>([]);
  const [postTitles, setPostTitles] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const user = authData.user;

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const name = String(
        user.user_metadata?.display_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "구단주"
      );

      if (!active) return;
      setEmail(user.email ?? "");
      setDisplayName(name);

      const [{ data: squadData, error: squadError }, { data: commentData, error: commentError }] = await Promise.all([
        supabase
          .from("squad_posts")
          .select("id,title,formation,total_value,views,likes_count,comments_count,created_at")
          .eq("author_id", user.id)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("squad_comments")
          .select("id,post_id,content,likes_count,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

      if (!active) return;
      if (squadError || commentError) {
        setMessage(squadError?.message || commentError?.message || "활동 내역을 불러오지 못했습니다.");
      }

      const loadedSquads = (squadData ?? []) as MySquad[];
      const loadedComments = (commentData ?? []) as MyComment[];
      setSquads(loadedSquads);
      setComments(loadedComments);

      const postIds = [...new Set(loadedComments.map((comment) => comment.post_id))];
      if (postIds.length > 0) {
        const { data: posts } = await supabase
          .from("squad_posts")
          .select("id,title")
          .in("id", postIds);
        if (active) {
          setPostTitles(
            Object.fromEntries((posts ?? []).map((post) => [String(post.id), String(post.title)]))
          );
        }
      }

      if (active) setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f1115] px-4 py-16 text-center text-sm text-gray-500">
        마이페이지를 불러오는 중...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f1115] text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black tracking-[0.16em] text-lime-400">MY FC HELP</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">마이페이지</h1>
            <p className="mt-2 text-sm text-gray-500">내 스쿼드와 커뮤니티 활동을 한곳에서 관리합니다.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/squad/gallery" className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-gray-300 transition hover:bg-white/5 hover:text-white">
              스쿼드 갤러리
            </Link>
            <button type="button" onClick={() => void logout()} className="rounded-xl border border-rose-300/20 bg-rose-400/5 px-4 py-2.5 text-sm font-bold text-rose-200 transition hover:bg-rose-400/10">
              로그아웃
            </button>
          </div>
        </div>

        <section className="mt-7 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-[#171b1f] p-5 sm:col-span-2">
            <p className="text-[11px] font-bold text-gray-500">프로필</p>
            <p className="mt-2 text-2xl font-black">{displayName}</p>
            <p className="mt-1 text-sm text-gray-400">{email}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-[#171b1f] p-4">
              <p className="text-[10px] font-bold text-gray-500">공유 스쿼드</p>
              <p className="mt-2 text-2xl font-black text-lime-300">{squads.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-[#171b1f] p-4">
              <p className="text-[10px] font-bold text-gray-500">작성 댓글</p>
              <p className="mt-2 text-2xl font-black text-lime-300">{comments.length}</p>
            </div>
          </div>
        </section>

        {message && (
          <p className="mt-5 rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-xs text-amber-200">{message}</p>
        )}

        <section className="mt-8">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black text-lime-400">MY SQUADS</p>
              <h2 className="mt-1 text-2xl font-black">내가 공유한 스쿼드</h2>
            </div>
            <Link href="/squad" className="text-xs font-black text-lime-300">새 스쿼드 만들기 →</Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#171b1f]">
            {squads.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-gray-600">아직 공유한 스쿼드가 없습니다.</div>
            ) : (
              <div className="divide-y divide-white/[0.07]">
                {squads.map((squad) => (
                  <Link key={squad.id} href={`/squad/gallery/${squad.id}`} className="block px-4 py-4 transition hover:bg-white/[0.025] sm:px-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-base font-black text-white">{squad.title}</p>
                        <p className="mt-1 text-[11px] text-gray-500">{squad.formation} · {formatDate(squad.created_at)}</p>
                      </div>
                      <span className="shrink-0 text-xs font-black text-lime-300">자세히 →</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-gray-500">
                      <span>조회 {squad.views.toLocaleString("ko-KR")}</span>
                      <span>♥ {squad.likes_count.toLocaleString("ko-KR")}</span>
                      <span>댓글 {squad.comments_count.toLocaleString("ko-KR")}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-3">
            <p className="text-xs font-black text-lime-400">MY COMMENTS</p>
            <h2 className="mt-1 text-2xl font-black">내가 쓴 댓글</h2>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#171b1f]">
            {comments.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-gray-600">아직 작성한 댓글이 없습니다.</div>
            ) : (
              <div className="divide-y divide-white/[0.07]">
                {comments.map((comment) => (
                  <Link key={comment.id} href={`/squad/gallery/${comment.post_id}`} className="block px-4 py-4 transition hover:bg-white/[0.025] sm:px-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-xs font-black text-lime-300">{postTitles[comment.post_id] ?? "스쿼드 게시글"}</p>
                      <span className="shrink-0 text-[10px] text-gray-600">{formatDate(comment.created_at)}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-300">{comment.content}</p>
                    <p className="mt-2 text-[10px] font-bold text-gray-600">좋아요 {comment.likes_count.toLocaleString("ko-KR")}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
