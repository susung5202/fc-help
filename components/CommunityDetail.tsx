"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReportButton from "@/components/ReportButton";
import ThreadedComments, { type ThreadedCommentData, type ThreadedCommentProfile } from "@/components/ThreadedComments";
import { createClient } from "@/lib/supabase/client";

type Post = {
  id: string;
  author_id: string;
  category: "free" | "question" | "tip" | "squad";
  title: string;
  content: string;
  image_urls: string[] | null;
  created_at: string;
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
  const [profiles, setProfiles] = useState<Record<string, ThreadedCommentProfile>>({});
  const [comments, setComments] = useState<ThreadedCommentData[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setMessage("");

    const [{ data: postData, error: postError }, { data: commentData }, { data: likeData }, { data: authData }] = await Promise.all([
      supabase.from("community_posts").select("id,author_id,category,title,content,image_urls,created_at").eq("id", id).maybeSingle(),
      supabase.from("community_comments").select("id,post_id,user_id,parent_id,content,created_at,updated_at").eq("post_id", id).order("created_at", { ascending: true }),
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
    const loadedComments = (commentData ?? []) as ThreadedCommentData[];
    const uid = authData.user?.id ?? null;
    setPost(loadedPost);
    setComments(loadedComments);
    setCommentCount(loadedComments.length);
    setViewerId(uid);
    setLikeCount((likeData ?? []).length);
    setLiked(Boolean(uid && (likeData ?? []).some((row) => row.user_id === uid)));

    const userIds = Array.from(new Set([loadedPost.author_id, ...loadedComments.map((comment) => comment.user_id)]));
    const { data: profileRows } = await supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", userIds);
    setProfiles(Object.fromEntries(((profileRows ?? []) as ThreadedCommentProfile[]).map((profile) => [profile.id, profile])));
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

  async function deletePost() {
    if (!post || post.author_id !== viewerId || !window.confirm("게시글을 삭제할까요?")) return;
    const { data: mediaData } = await supabase.from("community_posts").select("image_paths").eq("id", post.id).maybeSingle();
    const paths = Array.isArray(mediaData?.image_paths) ? (mediaData.image_paths as string[]) : [];
    const { error } = await supabase.from("community_posts").delete().eq("id", post.id).eq("author_id", viewerId);
    if (error) { setMessage(error.message); return; }
    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage.from("community-media").remove(paths);
      if (storageError) console.warn("Community image cleanup failed", storageError);
    }
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
  const images = Array.isArray(post.image_urls) ? post.image_urls : [];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/community" className="text-sm font-bold text-gray-400 hover:text-white">← 커뮤니티</Link>
        <div className="flex items-center gap-2">
          {isOwner ? (
            <>
              <Link href={`/community/${post.id}/edit`} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-gray-200 hover:bg-white/5">수정</Link>
              <button type="button" onClick={() => void deletePost()} className="rounded-lg border border-red-400/20 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-400/5">게시글 삭제</button>
            </>
          ) : (
            <ReportButton targetType="community_post" targetId={post.id} reportedUserId={post.author_id} viewerId={viewerId} className="rounded-lg border border-red-400/15 px-3 py-2 text-xs font-bold text-red-300/80 hover:bg-red-400/5" />
          )}
        </div>
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

        {images.length > 0 && (
          <div className={`mt-5 grid gap-2 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
            {images.map((url, index) => (
              <a key={`${url}-${index}`} href={url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
                <img src={url} alt={`게시글 첨부 이미지 ${index + 1}`} className={`w-full object-cover ${images.length === 1 ? "max-h-[640px]" : "aspect-square"}`} />
              </a>
            ))}
          </div>
        )}

        <div className="mt-7 flex items-center gap-3 border-t border-white/10 pt-4">
          <button type="button" onClick={() => void toggleLike()} className={`rounded-xl border px-4 py-2.5 text-sm font-black transition ${liked ? "border-rose-300/35 bg-rose-400/10 text-rose-300" : "border-white/10 text-gray-300 hover:bg-white/5"}`}>
            {liked ? "♥ 좋아요" : "♡ 좋아요"} {likeCount}
          </button>
          <span className="text-xs font-bold text-gray-500">댓글 {commentCount}</span>
        </div>
      </article>

      {message && <p className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/5 px-3 py-2 text-xs text-amber-100">{message}</p>}

      <ThreadedComments
        kind="community"
        postId={post.id}
        initialComments={comments}
        initialProfiles={profiles}
        viewerId={viewerId}
        maxLength={1000}
        placeholder="댓글을 남겨보세요."
        onCountChange={setCommentCount}
      />
    </div>
  );
}
