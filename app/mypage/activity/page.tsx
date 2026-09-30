"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MyPageNav from "@/components/MyPageNav";
import { createClient } from "@/lib/supabase/client";

type ActivityTab = "posts" | "comments" | "likes";
type SourceFilter = "all" | "community" | "squad";
type SourceType = "community" | "squad";

type PostActivity = {
  source: SourceType;
  id: string;
  title: string;
  subtitle: string;
  createdAt: string;
  href: string;
};

type CommentActivity = {
  source: SourceType;
  id: string;
  postId: string;
  postTitle: string;
  content: string;
  isReply: boolean;
  createdAt: string;
  href: string;
};

type LikeActivity = {
  source: SourceType;
  postId: string;
  postTitle: string;
  createdAt: string;
  href: string;
};

type CommunityPost = {
  id: string;
  category: string;
  title: string;
  created_at: string;
};

type SquadPost = {
  id: string;
  title: string;
  formation: string;
  is_public: boolean;
  likes_count: number;
  comments_count: number;
  views: number;
  created_at: string;
};

type CommunityComment = {
  id: number;
  post_id: string;
  parent_id: number | null;
  content: string;
  created_at: string;
};

type SquadComment = {
  id: number;
  post_id: string;
  parent_id: number | null;
  content: string;
  created_at: string;
};

type LikeRow = {
  post_id: string;
  created_at: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  free: "자유",
  question: "질문",
  tip: "팁·정보",
  squad: "스쿼드",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sourceLabel(source: SourceType) {
  return source === "community" ? "커뮤니티" : "스쿼드";
}

export default function MyActivityPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<ActivityTab>("posts");
  const [filter, setFilter] = useState<SourceFilter>("all");
  const [posts, setPosts] = useState<PostActivity[]>([]);
  const [comments, setComments] = useState<CommentActivity[]>([]);
  const [likes, setLikes] = useState<LikeActivity[]>([]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError("");

      const { data: authData, error: authError } = await supabase.auth.getUser();
      const user = authData.user;
      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const [
        communityPostsResult,
        squadPostsResult,
        communityCommentsResult,
        squadCommentsResult,
        communityLikesResult,
        squadLikesResult,
      ] = await Promise.all([
        supabase
          .from("community_posts")
          .select("id,category,title,created_at")
          .eq("author_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("squad_posts")
          .select("id,title,formation,is_public,likes_count,comments_count,views,created_at")
          .eq("author_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("community_comments")
          .select("id,post_id,parent_id,content,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("squad_comments")
          .select("id,post_id,parent_id,content,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("community_likes")
          .select("post_id,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("squad_likes")
          .select("post_id,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      const firstError = [
        communityPostsResult.error,
        squadPostsResult.error,
        communityCommentsResult.error,
        squadCommentsResult.error,
        communityLikesResult.error,
        squadLikesResult.error,
      ].find(Boolean);

      if (firstError) {
        if (active) {
          setError(firstError.message);
          setLoading(false);
        }
        return;
      }

      const communityPosts = (communityPostsResult.data ?? []) as CommunityPost[];
      const squadPosts = (squadPostsResult.data ?? []) as SquadPost[];
      const communityComments = (communityCommentsResult.data ?? []) as CommunityComment[];
      const squadComments = (squadCommentsResult.data ?? []) as SquadComment[];
      const communityLikes = (communityLikesResult.data ?? []) as LikeRow[];
      const squadLikes = (squadLikesResult.data ?? []) as LikeRow[];

      const communityTargetIds = Array.from(
        new Set([
          ...communityComments.map((item) => item.post_id),
          ...communityLikes.map((item) => item.post_id),
        ])
      );
      const squadTargetIds = Array.from(
        new Set([
          ...squadComments.map((item) => item.post_id),
          ...squadLikes.map((item) => item.post_id),
        ])
      );

      const [communityTargetsResult, squadTargetsResult] = await Promise.all([
        communityTargetIds.length
          ? supabase.from("community_posts").select("id,title").in("id", communityTargetIds)
          : Promise.resolve({ data: [], error: null }),
        squadTargetIds.length
          ? supabase.from("squad_posts").select("id,title").in("id", squadTargetIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const communityTitleMap = new Map<string, string>();
      for (const item of communityTargetsResult.data ?? []) {
        communityTitleMap.set(String(item.id), String(item.title));
      }
      const squadTitleMap = new Map<string, string>();
      for (const item of squadTargetsResult.data ?? []) {
        squadTitleMap.set(String(item.id), String(item.title));
      }

      const postItems: PostActivity[] = [
        ...communityPosts.map((item) => ({
          source: "community" as const,
          id: item.id,
          title: item.title,
          subtitle: CATEGORY_LABEL[item.category] ?? item.category,
          createdAt: item.created_at,
          href: `/community/${item.id}`,
        })),
        ...squadPosts.map((item) => ({
          source: "squad" as const,
          id: item.id,
          title: item.title,
          subtitle: `${item.formation || "포메이션 미지정"} · 좋아요 ${Number(item.likes_count || 0).toLocaleString("ko-KR")} · 댓글 ${Number(item.comments_count || 0).toLocaleString("ko-KR")} · 조회 ${Number(item.views || 0).toLocaleString("ko-KR")}${item.is_public ? "" : " · 비공개"}`,
          createdAt: item.created_at,
          href: `/squad/gallery/${item.id}`,
        })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const commentItems: CommentActivity[] = [
        ...communityComments.map((item) => ({
          source: "community" as const,
          id: String(item.id),
          postId: item.post_id,
          postTitle: communityTitleMap.get(item.post_id) ?? "삭제된 글",
          content: item.content,
          isReply: item.parent_id != null,
          createdAt: item.created_at,
          href: communityTitleMap.has(item.post_id) ? `/community/${item.post_id}` : "",
        })),
        ...squadComments.map((item) => ({
          source: "squad" as const,
          id: String(item.id),
          postId: item.post_id,
          postTitle: squadTitleMap.get(item.post_id) ?? "삭제된 스쿼드",
          content: item.content,
          isReply: item.parent_id != null,
          createdAt: item.created_at,
          href: squadTitleMap.has(item.post_id) ? `/squad/gallery/${item.post_id}` : "",
        })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const likeItems: LikeActivity[] = [
        ...communityLikes.map((item) => ({
          source: "community" as const,
          postId: item.post_id,
          postTitle: communityTitleMap.get(item.post_id) ?? "삭제된 글",
          createdAt: item.created_at,
          href: communityTitleMap.has(item.post_id) ? `/community/${item.post_id}` : "",
        })),
        ...squadLikes.map((item) => ({
          source: "squad" as const,
          postId: item.post_id,
          postTitle: squadTitleMap.get(item.post_id) ?? "삭제된 스쿼드",
          createdAt: item.created_at,
          href: squadTitleMap.has(item.post_id) ? `/squad/gallery/${item.post_id}` : "",
        })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (!active) return;
      setPosts(postItems);
      setComments(commentItems);
      setLikes(likeItems);
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  const filteredPosts = useMemo(
    () => posts.filter((item) => filter === "all" || item.source === filter),
    [filter, posts]
  );
  const filteredComments = useMemo(
    () => comments.filter((item) => filter === "all" || item.source === filter),
    [comments, filter]
  );
  const filteredLikes = useMemo(
    () => likes.filter((item) => filter === "all" || item.source === filter),
    [filter, likes]
  );

  const emptyText =
    tab === "posts"
      ? "아직 작성한 글이 없습니다."
      : tab === "comments"
        ? "아직 작성한 댓글이 없습니다."
        : "아직 좋아요한 글이 없습니다.";

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f1115] px-4 py-20 text-center text-sm text-gray-500">
        내 활동을 불러오는 중...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f1115] text-white">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black tracking-[0.18em] text-lime-400">MY ACTIVITY</p>
            <h1 className="mt-1 text-3xl font-black">내 활동</h1>
            <p className="mt-2 text-sm text-gray-500">내가 작성하거나 좋아요한 커뮤니티·스쿼드 활동을 모아봅니다.</p>
          </div>
        </div>

        <div className="mt-6">
          <MyPageNav />
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-300/20 bg-red-400/5 px-4 py-3 text-sm text-red-200">
            내 활동을 불러오지 못했습니다. {error}
          </div>
        )}

        <div className="mt-7 grid grid-cols-3 rounded-2xl border border-white/10 bg-[#171b1f] p-1.5">
          {([
            ["posts", `작성 글 ${posts.length}`],
            ["comments", `댓글 ${comments.length}`],
            ["likes", `좋아요 ${likes.length}`],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-xl px-2 py-3 text-xs font-black transition sm:text-sm ${
                tab === value ? "bg-white text-black" : "text-gray-500 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {([
            ["all", "전체"],
            ["community", "커뮤니티"],
            ["squad", "스쿼드"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                filter === value
                  ? "border-lime-300/40 bg-lime-300/10 text-lime-200"
                  : "border-white/10 text-gray-500 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-5 space-y-3">
          {tab === "posts" &&
            filteredPosts.map((item) => (
              <Link
                key={`${item.source}-${item.id}`}
                href={item.href}
                className="block rounded-2xl border border-white/10 bg-[#171b1f] p-4 transition hover:border-white/20 hover:bg-[#1b1f24] sm:p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${item.source === "community" ? "bg-sky-300/10 text-sky-200" : "bg-lime-300/10 text-lime-200"}`}>
                    {sourceLabel(item.source)}
                  </span>
                  <span className="text-[11px] text-gray-600">{formatDate(item.createdAt)}</span>
                </div>
                <h2 className="mt-3 line-clamp-2 text-base font-black text-gray-100">{item.title}</h2>
                <p className="mt-2 text-xs text-gray-500">{item.subtitle}</p>
              </Link>
            ))}

          {tab === "comments" &&
            filteredComments.map((item) => {
              const card = (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${item.source === "community" ? "bg-sky-300/10 text-sky-200" : "bg-lime-300/10 text-lime-200"}`}>
                        {sourceLabel(item.source)}
                      </span>
                      {item.isReply && <span className="text-[10px] font-bold text-amber-200">답글</span>}
                    </div>
                    <span className="text-[11px] text-gray-600">{formatDate(item.createdAt)}</span>
                  </div>
                  <p className="mt-3 text-xs font-bold text-gray-500">원문 · {item.postTitle}</p>
                  <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-gray-200">{item.content}</p>
                </>
              );

              return item.href ? (
                <Link
                  key={`${item.source}-${item.id}`}
                  href={item.href}
                  className="block rounded-2xl border border-white/10 bg-[#171b1f] p-4 transition hover:border-white/20 hover:bg-[#1b1f24] sm:p-5"
                >
                  {card}
                </Link>
              ) : (
                <div key={`${item.source}-${item.id}`} className="rounded-2xl border border-white/10 bg-[#171b1f] p-4 opacity-70 sm:p-5">
                  {card}
                </div>
              );
            })}

          {tab === "likes" &&
            filteredLikes.map((item, index) => {
              const card = (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${item.source === "community" ? "bg-sky-300/10 text-sky-200" : "bg-lime-300/10 text-lime-200"}`}>
                      {sourceLabel(item.source)}
                    </span>
                    <span className="text-[11px] text-gray-600">{formatDate(item.createdAt)}</span>
                  </div>
                  <div className="mt-3 flex items-start gap-3">
                    <span className="text-lg">♥</span>
                    <h2 className="line-clamp-2 text-base font-black text-gray-100">{item.postTitle}</h2>
                  </div>
                </>
              );

              return item.href ? (
                <Link
                  key={`${item.source}-${item.postId}-${index}`}
                  href={item.href}
                  className="block rounded-2xl border border-white/10 bg-[#171b1f] p-4 transition hover:border-white/20 hover:bg-[#1b1f24] sm:p-5"
                >
                  {card}
                </Link>
              ) : (
                <div key={`${item.source}-${item.postId}-${index}`} className="rounded-2xl border border-white/10 bg-[#171b1f] p-4 opacity-70 sm:p-5">
                  {card}
                </div>
              );
            })}

          {((tab === "posts" && filteredPosts.length === 0) ||
            (tab === "comments" && filteredComments.length === 0) ||
            (tab === "likes" && filteredLikes.length === 0)) && (
            <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
              <p className="text-sm font-bold text-gray-500">{emptyText}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
