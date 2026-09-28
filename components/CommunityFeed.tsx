"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Post = {
  id: string;
  author_id: string;
  category: "free" | "question" | "tip" | "squad";
  title: string;
  content: string;
  created_at: string;
};

type Profile = {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
};

const CATEGORIES = [
  ["all", "전체"],
  ["free", "자유"],
  ["question", "질문"],
  ["tip", "팁·정보"],
  ["squad", "스쿼드"],
] as const;

const CATEGORY_LABEL: Record<Post["category"], string> = {
  free: "자유",
  question: "질문",
  tip: "팁·정보",
  squad: "스쿼드",
};

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "방금 전";
  if (diff < hour) return `${Math.floor(diff / minute)}분 전`;
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}일 전`;
  return new Date(value).toLocaleDateString("ko-KR");
}

export default function CommunityFeed() {
  const supabase = useMemo(() => createClient(), []);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number][0]>("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      let query = supabase
        .from("community_posts")
        .select("id,author_id,category,title,content,created_at")
        .order("created_at", { ascending: false })
        .limit(40);
      if (category !== "all") query = query.eq("category", category);

      const { data, error: postError } = await query;
      if (!active) return;
      if (postError) {
        setError(postError.message);
        setPosts([]);
        setLoading(false);
        return;
      }

      const loaded = (data ?? []) as Post[];
      setPosts(loaded);
      if (loaded.length === 0) {
        setProfiles({});
        setLikeCounts({});
        setCommentCounts({});
        setLoading(false);
        return;
      }

      const postIds = loaded.map((post) => post.id);
      const authorIds = Array.from(new Set(loaded.map((post) => post.author_id)));
      const [{ data: profileRows }, { data: likeRows }, { data: commentRows }] = await Promise.all([
        supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", authorIds),
        supabase.from("community_likes").select("post_id").in("post_id", postIds),
        supabase.from("community_comments").select("post_id").in("post_id", postIds),
      ]);
      if (!active) return;

      setProfiles(Object.fromEntries(((profileRows ?? []) as Profile[]).map((profile) => [profile.id, profile])));
      setLikeCounts(countByPost((likeRows ?? []) as { post_id: string }[]));
      setCommentCounts(countByPost((commentRows ?? []) as { post_id: string }[]));
      setLoading(false);
    }

    void load();
    return () => { active = false; };
  }, [category, supabase]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-lime-400">COMMUNITY</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">FC Help 커뮤니티</h1>
          <p className="mt-2 text-sm text-gray-500">FC Online 이야기, 질문, 스쿼드와 팁을 자유롭게 나눠보세요.</p>
        </div>
        <Link href="/community/write" className="shrink-0 rounded-xl bg-lime-300 px-4 py-3 text-sm font-black text-black transition hover:bg-lime-200">글쓰기</Link>
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map(([value, label]) => (
          <button key={value} type="button" onClick={() => setCategory(value)} className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-black transition ${category === value ? "border-lime-300/40 bg-lime-300/10 text-lime-300" : "border-white/10 text-gray-400 hover:bg-white/5 hover:text-white"}`}>
            {label}
          </button>
        ))}
      </div>

      {error && <div className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/5 px-4 py-3 text-xs text-amber-100">{error}</div>}

      <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-[#15191d]">
        {loading ? (
          <div className="py-20 text-center text-sm text-gray-500">게시글을 불러오는 중...</div>
        ) : posts.length === 0 ? (
          <div className="py-20 text-center"><p className="font-black text-gray-300">아직 게시글이 없습니다.</p><Link href="/community/write" className="mt-2 inline-block text-sm font-black text-lime-300">첫 글 작성하기 →</Link></div>
        ) : (
          <div className="divide-y divide-white/[0.07]">
            {posts.map((post) => {
              const profile = profiles[post.author_id];
              const initial = (profile?.display_name || "F").trim().slice(0, 1).toUpperCase();
              return (
                <article key={post.id} className="px-4 py-4 transition hover:bg-white/[0.025] sm:px-5">
                  <div className="flex items-start gap-3">
                    <Link href={`/profile/${profile?.username || post.author_id}`} className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#242a27] text-xs font-black text-lime-200">
                      {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : initial}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                        <Link href={`/profile/${profile?.username || post.author_id}`} className="font-black text-gray-300 hover:text-lime-300">{profile?.display_name || "구단주"}</Link>
                        {profile?.username && <span>@{profile.username}</span>}
                        <span>·</span><span>{timeAgo(post.created_at)}</span>
                      </div>
                      <Link href={`/community/${post.id}`} className="mt-1.5 block">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md border border-lime-300/15 bg-lime-300/[0.05] px-2 py-1 text-[10px] font-black text-lime-200">{CATEGORY_LABEL[post.category]}</span>
                          <h2 className="min-w-0 truncate text-base font-black text-white sm:text-lg">{post.title}</h2>
                        </div>
                        <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm leading-6 text-gray-400">{post.content}</p>
                      </Link>
                      <div className="mt-3 flex gap-4 text-[11px] font-bold text-gray-600">
                        <span>♥ {likeCounts[post.id] ?? 0}</span><span>댓글 {commentCounts[post.id] ?? 0}</span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function countByPost(rows: { post_id: string }[]) {
  const result: Record<string, number> = {};
  rows.forEach((row) => { result[row.post_id] = (result[row.post_id] ?? 0) + 1; });
  return result;
}
