"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Post = {
  id: string;
  author_id: string;
  category: "free" | "question" | "tip" | "squad";
  title: string;
  content: string;
  created_at: string;
};

type Comment = {
  id: number;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

type Profile = {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
};

const CATEGORY_LABEL: Record<Post["category"], string> = {
  free: "자유",
  question: "질문",
  tip: "팁·정보",
  squad: "스쿼드",
};

export default function CommunityDetail({ id }: { id: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [post, setPost] = useState<Post | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [comments, setComments] = useState<Comment[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");

    const [{ data: postData, error: postError }, { data: commentData }, { data: likeData }, { data: authData }] = await Promise.all([
      supabase.from("community_posts").select("id,author_id,category,title,content,created_at").eq("id", id).maybeSingle(),
      supabase.from("community_comments").select("id,post_id,user_id,content,created_at").eq("post_id", id).order("created_at", { ascending: true }),
      supabase.from("community_likes").select("post_id,user_id").eq("post_id", id),
      supabase.auth.getUser(),
    ]);

    if (postError || !postData) {
      setPost(null);
      setMessage(postError?.message || "게시글을 찾을 수 없습니다.");
      setLoading(false);
      return;
    }

    const loadedPost = postData as Post;
    const loadedComments = (commentData ?? []) as Comment[];
    const uid = authData.user?.id ?? null;
    setPost(loadedPost);
    setComments(loadedComments);
    setViewerId(uid);
    setLikeCount((likeData ?? []).length);
    setLiked(Boolean(uid && (likeData ?? []).some((row) => row.user_id === uid)));

    const userIds = Array.from(new Set([loadedPost.author_id, ...loadedComments.map((comment) => comment.user_id)]));
    const { data: profileRows } = await supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", userIds);
    setProfiles(Object.fromEntries(((profileRows ?? []) as Profile[]).map((profile) => [profile.id, profile])));
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function toggleLike() {
    if (!viewerId) {
      router.push("/login");
      return;
    }

    if (liked) {
      const { error } = await supabase.from("community_likes").delete().eq("post_id", id).eq("user_id", viewerId);
      if (error) { setMessage(error.message); return; }
      setLiked(false);
      setLikeCount((count) => Math.max(0, count - 1));
    } else {
      const { error } = await supabase.from("community_likes").insert({ post_id: id, user_id: viewerId });
      if (error) { setMessage(error.message); return; }
      setLiked(true);
      setLikeCount((count) => count + 1);
    }
  }

  async function addComment() {
    if (!viewerId) {
      router.push("/login");
      return;
    }
    const content = commentText.trim();
    if (!content) return;

    const { error } = await supabase.from("community_comments").insert({ post_id: id, user_id: viewerId, content });
    if (error) { setMessage(error.message); return; }
    setCommentText("");
    await load();
  }

  async function deleteComment(commentId: number) {
    if (!viewerId || !window.confirm("댓글을 삭제할까요?")) return;
    const { error } = await supabase.from("community_comments").delete().eq("id", commentId).eq("user_id", viewerId);
    if (error) { setMessage(error.message); return; }
    setComments((current) => current.filter((comment) => comment.id !== commentId));
  }

  async function deletePost() {
    if (!post || post.author_id !== viewerId || !window.confirm("게시글을 삭제할까요?")) return;
    const { error } = await supabase.from("community_posts").delete().eq("id", post.id).eq("author_id", viewerId);
    if (error) { setMessage(error.message); return; }
    router.replace("/community");
    router.refresh();
  }

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-20 text-center text-sm text-gray-500">게시글을 불러오는 중...</div>;

  if (!post) {
    return <div className="mx-auto max-w-4xl px-4 py-20 text-center"><p className="font-black text-gray-300">게시글을 찾을 수 없습니다.</p>{message && <p className="mt-2 text-xs text-gray-600">{message}</p>}<Link href="/community" className="mt-4 inline-block text-sm font-black text-lime-300">커뮤니티로 돌아가기 →</Link></div>;
  }

  const author = profiles[post.author_id];
  const authorInitial = (author?.display_name || "F").trim().slice(0, 1).toUpperCase();
  const isOwner = viewerId === post.author_id;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/community" className="text-sm font-bold text-gray-400 hover:text-white">← 커뮤니티</Link>
        {isOwner && <button type="button" onClick={() => void deletePost()} className="rounded-lg border border-red-400/20 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-400/5">게시글 삭제</button>}
      </div>

      <article className="rounded-2xl border border-white/10 bg-[#15191d] p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <Link href={`/profile/${author?.username || post.author_id}`} className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#242a27] text-sm font-black text-lime-200">
            {author?.avatar_url ? <img src={author.avatar_url} alt="" className="h-full w-full object-cover" /> : authorInitial}
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <Link href={`/profile/${author?.username || post.author_id}`} className="font-black text-gray-200 hover:text-lime-300">{author?.display_name || "구단주"}</Link>
              {author?.username && <span>@{author.username}</span>}
              <span>·</span><span>{new Date(post.created_at).toLocaleString("ko-KR")}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <span className="rounded-md border border-lime-300/15 bg-lime-300/[0.05] px-2 py-1 text-[10px] font-black text-lime-200">{CATEGORY_LABEL[post.category]}</span>
          <h1 className="text-xl font-black leading-8 text-white sm:text-2xl">{post.title}</h1>
        </div>
        <p className="mt-5 min-h-32 whitespace-pre-wrap break-words text-sm leading-7 text-gray-200 sm:text-base">{post.content}</p>

        <div className="mt-7 flex items-center gap-3 border-t border-white/10 pt-4">
          <button type="button" onClick={() => void toggleLike()} className={`rounded-xl border px-4 py-2.5 text-sm font-black transition ${liked ? "border-rose-300/35 bg-rose-400/10 text-rose-300" : "border-white/10 text-gray-300 hover:bg-white/5"}`}>
            {liked ? "♥ 좋아요" : "♡ 좋아요"} {likeCount}
          </button>
          <span className="text-xs font-bold text-gray-500">댓글 {comments.length}</span>
        </div>
      </article>

      {message && <p className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/5 px-3 py-2 text-xs text-amber-100">{message}</p>}

      <section className="mt-5 rounded-2xl border border-white/10 bg-[#15191d] p-4 sm:p-5">
        <h2 className="text-lg font-black">댓글 <span className="text-lime-300">{comments.length}</span></h2>
        <div className="mt-4 flex gap-2">
          <textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} maxLength={1000} rows={3} placeholder={viewerId ? "댓글을 남겨보세요." : "로그인 후 댓글을 작성할 수 있습니다."} className="min-w-0 flex-1 resize-none rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-sm outline-none placeholder:text-gray-600 focus:border-lime-300/40" />
          <button type="button" onClick={() => void addComment()} className="rounded-xl bg-lime-300 px-4 text-sm font-black text-black">등록</button>
        </div>

        <div className="mt-5 space-y-3">
          {comments.length === 0 && <p className="py-8 text-center text-sm text-gray-600">아직 댓글이 없습니다.</p>}
          {comments.map((comment) => {
            const profile = profiles[comment.user_id];
            const initial = (profile?.display_name || "F").trim().slice(0, 1).toUpperCase();
            return (
              <div key={comment.id} className="rounded-xl border border-white/[0.08] bg-black/10 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/profile/${profile?.username || comment.user_id}`} className="inline-flex min-w-0 items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#242a27] text-[10px] font-black text-lime-200">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : initial}</span>
                    <span className="min-w-0"><span className="block truncate text-xs font-black text-gray-200">{profile?.display_name || "구단주"}</span>{profile?.username && <span className="block truncate text-[10px] text-gray-600">@{profile.username}</span>}</span>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2"><span className="text-[10px] text-gray-600">{new Date(comment.created_at).toLocaleString("ko-KR")}</span>{viewerId === comment.user_id && <button type="button" onClick={() => void deleteComment(comment.id)} className="text-[10px] font-bold text-red-300/80">삭제</button>}</div>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-300">{comment.content}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
