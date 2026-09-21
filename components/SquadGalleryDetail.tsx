"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import SquadFeedCard, { type SquadFeedPost } from "@/components/SquadFeedCard";

type Comment = {
  id: number;
  post_id: string;
  user_id: string;
  author_name: string;
  parent_id: number | null;
  content: string;
  likes_count: number;
  created_at: string;
};

export default function SquadGalleryDetail({ id }: { id: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [post, setPost] = useState<SquadFeedPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const [{ data: postData, error: postError }, { data: commentData }, { data: authData }] = await Promise.all([
      supabase.from("squad_posts").select("id,author_name,title,description,formation,squad_data,player_names,team_colors,total_salary,total_value,average_ovr,likes_count,comments_count,views,created_at").eq("id", id).single(),
      supabase.from("squad_comments").select("id,post_id,user_id,author_name,parent_id,content,likes_count,created_at").eq("post_id", id).order("created_at", { ascending: true }),
      supabase.auth.getUser(),
    ]);

    if (postError) {
      setMessage(postError.message);
      setPost(null);
      setLoading(false);
      return;
    }

    const uid = authData.user?.id ?? null;
    setUserId(uid);
    setPost(postData as SquadFeedPost);
    setComments((commentData ?? []) as Comment[]);

    if (uid) {
      const { data: likeData } = await supabase.from("squad_likes").select("post_id").eq("post_id", id).eq("user_id", uid).maybeSingle();
      setLiked(Boolean(likeData));
    }

    setLoading(false);
  }

  useEffect(() => {
    void load();
    void supabase.rpc("increment_squad_post_views", { target_id: id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function toggleLike() {
    if (!userId) {
      router.push("/login");
      return;
    }
    if (liked) {
      await supabase.from("squad_likes").delete().eq("post_id", id).eq("user_id", userId);
    } else {
      await supabase.from("squad_likes").insert({ post_id: id, user_id: userId });
    }
    setLiked(!liked);
    setPost((current) => current ? { ...current, likes_count: Math.max(0, current.likes_count + (liked ? -1 : 1)) } : current);
  }

  async function addComment() {
    if (!userId) {
      router.push("/login");
      return;
    }
    const text = content.trim();
    if (!text) return;
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) return;
    const authorName = String(user.user_metadata?.display_name || user.user_metadata?.name || user.email?.split("@")[0] || "구단주").slice(0, 40);
    const { error } = await supabase.from("squad_comments").insert({ post_id: id, user_id: userId, author_name: authorName, content: text });
    if (error) {
      setMessage(error.message);
      return;
    }
    setContent("");
    await load();
  }

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-gray-500">스쿼드를 불러오는 중...</div>;
  }

  if (!post) {
    return <div className="mx-auto max-w-6xl px-4 py-16 text-center"><p className="text-gray-300">스쿼드를 찾을 수 없습니다.</p><Link href="/squad/gallery" className="mt-3 inline-block text-sm font-black text-lime-300">갤러리로 돌아가기</Link></div>;
  }

  const topLevel = comments.filter((comment) => comment.parent_id == null);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/squad/gallery" className="text-sm font-bold text-gray-400 hover:text-white">← 스쿼드 갤러리</Link>
        <button type="button" onClick={() => void toggleLike()} className={`rounded-xl border px-4 py-2.5 text-sm font-black transition ${liked ? "border-rose-300/40 bg-rose-400/10 text-rose-300" : "border-white/10 text-gray-300 hover:bg-white/5"}`}>
          {liked ? "♥ 좋아요 취소" : "♡ 좋아요"}
        </button>
      </div>

      <SquadFeedCard post={post} />

      <section className="mt-5 rounded-2xl border border-white/10 bg-[#171b1f] p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black">댓글 <span className="text-lime-300">{comments.length}</span></h2>
          {!userId && <Link href="/login" className="text-xs font-bold text-lime-300">로그인 후 작성</Link>}
        </div>

        <div className="mt-4 flex gap-2">
          <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={500} rows={3} placeholder="스쿼드에 대한 의견을 남겨보세요." className="min-w-0 flex-1 resize-none rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-sm outline-none placeholder:text-gray-600 focus:border-lime-400/50" />
          <button type="button" onClick={() => void addComment()} className="self-stretch rounded-xl bg-lime-300 px-4 text-sm font-black text-black">등록</button>
        </div>
        {message && <p className="mt-3 text-xs text-amber-300">{message}</p>}

        <div className="mt-5 space-y-3">
          {topLevel.length === 0 && <p className="py-8 text-center text-sm text-gray-600">아직 댓글이 없습니다.</p>}
          {topLevel.map((comment) => (
            <div key={comment.id} className="rounded-xl border border-white/[0.08] bg-black/10 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black text-gray-200">{comment.author_name}</span>
                <span className="text-[10px] text-gray-600">{new Date(comment.created_at).toLocaleString("ko-KR")}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-300">{comment.content}</p>
              <div className="mt-2 text-[10px] font-bold text-gray-600">좋아요 {comment.likes_count}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
