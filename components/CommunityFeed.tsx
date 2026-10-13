"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Post = {
  id: string;
  author_id: string;
  category: "free" | "question" | "tip" | "squad";
  title: string;
  content: string;
  created_at: string;
  is_notice: boolean;
};

type Profile = {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
};

type FeedMode = "latest" | "popular";

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

function normalizeSearch(value: string) {
  return value
    .replace(/[(),%_"\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

export default function CommunityFeed() {
  const supabase = useMemo(() => createClient(), []);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number][0]>("all");
  const [mode, setMode] = useState<FeedMode>("latest");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
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

      const columns = "id,author_id,category,title,content,created_at,is_notice";
      // Fetch every notice separately, regardless of category/sort/date limits.
      // Supabase applies row limits, so fetch in pages instead of assuming 1000 is enough.
      const notices: Post[] = [];
      const PAGE_SIZE = 500;
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data: page, error: noticeError } = await supabase
          .from("community_posts")
          .select(columns)
          .eq("is_notice", true)
          .order("created_at", { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);
        if (!active) return;
        if (noticeError) {
          setError("공지글을 불러오지 못했습니다: " + noticeError.message);
          setLoading(false);
          return;
        }
        notices.push(...((page ?? []) as Post[]));
        if ((page?.length ?? 0) < PAGE_SIZE) break;
      }

      let query = supabase
        .from("community_posts")
        .select(columns)
        .order("created_at", { ascending: false });

      if (category !== "all") query = query.eq("category", category);
      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`);
      }
      if (mode === "popular") {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte("created_at", since).limit(100);
      } else {
        query = query.limit(40);
      }

      const { data, error: postError } = await query;
      if (!active) return;
      if (postError) {
        setError(postError.message);
        setPosts([]);
        setLoading(false);
        return;
      }

      const regular = (data ?? []) as Post[];
      const noticeIds = new Set(notices.map((post) => post.id));
      const loaded = [
        ...notices,
        ...regular.filter((post) => !noticeIds.has(post.id) && !post.is_notice),
      ];
      if (loaded.length === 0) {
        setPosts([]);
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

      const nextLikeCounts = countByPost((likeRows ?? []) as { post_id: string }[]);
      const nextCommentCounts = countByPost((commentRows ?? []) as { post_id: string }[]);
      const noticePosts = loaded.filter((post) => post.is_notice)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const regularPosts = loaded.filter((post) => !post.is_notice);
      const sortedRegular = mode === "popular"
        ? [...regularPosts].sort((a, b) => {
            const aScore = (nextLikeCounts[a.id] ?? 0) * 2 + (nextCommentCounts[a.id] ?? 0);
            const bScore = (nextLikeCounts[b.id] ?? 0) * 2 + (nextCommentCounts[b.id] ?? 0);
            if (bScore !== aScore) return bScore - aScore;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          })
        : regularPosts;
      const sortedPosts = [...noticePosts, ...sortedRegular];

      setPosts(sortedPosts);
      setProfiles(Object.fromEntries(((profileRows ?? []) as Profile[]).map((profile) => [profile.id, profile])));
      setLikeCounts(nextLikeCounts);
      setCommentCounts(nextCommentCounts);
      setLoading(false);
    }

    void load();
    return () => { active = false; };
  }, [category, mode, searchTerm, supabase]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeSearch(searchInput);
    setSearchInput(normalized);
    setSearchTerm(normalized);
  }

  function clearSearch() {
    setSearchInput("");
    setSearchTerm("");
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-6 sm:py-10">
      <div className="flex items-center justify-between gap-2 sm:items-end sm:gap-4">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-lime-400">COMMUNITY</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-4xl">FC Help 커뮤니티</h1>
          <p className="mt-2 hidden text-sm text-gray-500 sm:block">FC Online 이야기, 질문, 스쿼드와 팁을 자유롭게 나눠보세요.</p>
        </div>
        <Link href="/community/write" className="shrink-0 rounded-xl bg-lime-300 px-3 py-2.5 text-xs font-black text-black transition hover:bg-lime-200 sm:px-4 sm:py-3 sm:text-sm">글쓰기</Link>
      </div>

      <form onSubmit={submitSearch} className="mt-6 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            maxLength={40}
            placeholder="제목이나 내용 검색"
            className="h-11 w-full rounded-xl border border-white/10 bg-[#15191d] px-4 pr-12 text-sm text-white outline-none placeholder:text-gray-600 focus:border-lime-300/35"
          />
          {searchInput && (
            <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 px-1 text-xs font-black text-gray-500 hover:text-white" aria-label="검색어 지우기">✕</button>
          )}
        </div>
        <button type="submit" className="h-11 shrink-0 rounded-xl border border-lime-300/25 bg-lime-300/[0.07] px-4 text-sm font-black text-lime-300 transition hover:bg-lime-300/10">검색</button>
      </form>

      <div className="mt-4 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex gap-1 rounded-xl bg-white/[0.035] p-1">
          <button type="button" onClick={() => setMode("latest")} className={`rounded-lg px-3.5 py-2 text-xs font-black transition ${mode === "latest" ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}>최신</button>
          <button type="button" onClick={() => setMode("popular")} className={`rounded-lg px-3.5 py-2 text-xs font-black transition ${mode === "popular" ? "bg-rose-400/10 text-rose-300" : "text-gray-500 hover:text-gray-300"}`}>🔥 인기</button>
        </div>
        {mode === "popular" && <span className="text-[10px] font-bold text-gray-600">최근 7일 · 좋아요×2 + 댓글</span>}
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map(([value, label]) => (
          <button key={value} type="button" onClick={() => setCategory(value)} className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-black transition ${category === value ? "border-lime-300/40 bg-lime-300/10 text-lime-300" : "border-white/10 text-gray-400 hover:bg-white/5 hover:text-white"}`}>
            {label}
          </button>
        ))}
      </div>

      {!loading && !error && <p className="mt-2 text-xs text-gray-500">{posts.length}개 게시글 · 공지 {posts.filter((post) => post.is_notice).length}개 · {mode === "popular" ? "최근 7일 인기순" : "최신순"}</p>}

      {searchTerm && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-2.5 text-xs">
          <p className="min-w-0 truncate text-gray-400"><span className="font-black text-white">“{searchTerm}”</span> 검색 결과</p>
          <button type="button" onClick={clearSearch} className="shrink-0 font-black text-lime-300">검색 해제</button>
        </div>
      )}

      {error && <div className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/5 px-4 py-3 text-xs text-amber-100">{error}</div>}

      <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-[#15191d] sm:mt-5 sm:rounded-2xl">
        {loading ? (
          <div className="py-20 text-center text-sm text-gray-500">게시글을 불러오는 중...</div>
        ) : posts.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-black text-gray-300">{searchTerm ? "검색 결과가 없습니다." : mode === "popular" ? "최근 7일 인기글이 없습니다." : "아직 게시글이 없습니다."}</p>
            {searchTerm ? (
              <button type="button" onClick={clearSearch} className="mt-2 text-sm font-black text-lime-300">전체 글 보기 →</button>
            ) : (
              <Link href="/community/write" className="mt-2 inline-block text-sm font-black text-lime-300">첫 글 작성하기 →</Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.07]">
            {posts.map((post, index) => {
              const profile = profiles[post.author_id];
              const initial = (profile?.display_name || "F").trim().slice(0, 1).toUpperCase();
              const likes = likeCounts[post.id] ?? 0;
              const comments = commentCounts[post.id] ?? 0;
              const popularScore = likes * 2 + comments;
              return (
                <article key={post.id} className={`px-3 py-3 transition hover:bg-white/[0.025] sm:px-5 sm:py-4 ${post.is_notice ? "border-l-2 border-l-lime-300 bg-lime-300/[0.04]" : ""}`}>
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <Link href={`/profile/${profile?.username || post.author_id}`} className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#242a27] text-xs font-black text-lime-200 sm:h-9 sm:w-9">
                      {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : initial}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                        {post.is_notice ? <span className="font-black text-lime-300">공지 고정</span> : mode === "popular" && <span className="font-black text-rose-300">#{index + 1 - posts.filter((p) => p.is_notice).length}</span>}
                        <Link href={`/profile/${profile?.username || post.author_id}`} className="font-black text-gray-300 hover:text-lime-300">{profile?.display_name || "구단주"}</Link>
                        {profile?.username && <span>@{profile.username}</span>}
                        <span>·</span><span>{timeAgo(post.created_at)}</span>
                      </div>
                      <Link href={`/community/${post.id}`} className="mt-1.5 block rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-300">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {post.is_notice && <span className="rounded-md bg-lime-300 px-1.5 py-0.5 text-[10px] font-black text-black">📌 공지</span>}
                          <span className="rounded-md border border-lime-300/15 bg-lime-300/[0.05] px-1.5 py-0.5 text-[10px] font-black text-lime-200 sm:px-2 sm:py-1">{CATEGORY_LABEL[post.category]}</span>
                          {mode === "popular" && popularScore > 0 && <span className="rounded-md border border-rose-300/15 bg-rose-400/[0.05] px-1.5 py-0.5 text-[10px] font-black text-rose-300">HOT {popularScore}</span>}
                        </div>
                        <h2 className="mt-1.5 line-clamp-2 break-words text-sm font-black leading-5 text-white sm:text-lg sm:leading-7">{post.title}</h2>
                        <p className="mt-1 line-clamp-1 whitespace-pre-wrap text-xs leading-5 text-gray-500 sm:mt-2 sm:line-clamp-2 sm:text-sm sm:leading-6 sm:text-gray-400">{post.content}</p>
                      </Link>
                      <div className="mt-2 flex gap-4 text-[11px] font-bold text-gray-500 sm:mt-3">
                        <span>♥ {likes}</span><span>댓글 {comments}</span>
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
