"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PlayerArtwork from "@/components/PlayerArtwork";
import SquadFeedCard, { type SquadFeedPost } from "@/components/SquadFeedCard";
import { formatGalleryValue, getGallerySlots } from "@/lib/fconline/squadGallery";

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

type PlayerDetail = {
  salary: number | null;
  prices: Array<string | null>;
  positionOvr: number | null;
  failed?: boolean;
};

function formatPlayerPrice(value: string | null | undefined) {
  if (!value) return "가격 정보 없음";
  return formatGalleryValue(value);
}

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
  const [playerDetails, setPlayerDetails] = useState<Record<string, PlayerDetail>>({});
  const [playerDetailsLoading, setPlayerDetailsLoading] = useState(false);

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

  useEffect(() => {
    if (!post) return;
    let active = true;

    async function loadPlayerDetails() {
      const players = post.squad_data.players ?? {};
      const slots = getGallerySlots(post.squad_data).filter((slot) => players[slot.slotId]);
      setPlayerDetailsLoading(true);
      const next: Record<string, PlayerDetail> = {};

      for (let index = 0; index < slots.length; index += 3) {
        const batch = slots.slice(index, index + 3);
        const results = await Promise.all(batch.map(async (slot) => {
          const player = players[slot.slotId]!;
          try {
            const response = await fetch(`/api/squad/card?spid=${player.id}&name=${encodeURIComponent(player.name)}&position=${encodeURIComponent(slot.label)}`);
            if (!response.ok) throw new Error("card request failed");
            const data = await response.json() as PlayerDetail;
            return [slot.slotId, data] as const;
          } catch {
            return [slot.slotId, { salary: null, prices: Array.from({ length: 13 }, () => null), positionOvr: null, failed: true }] as const;
          }
        }));

        results.forEach(([slotId, detail]) => {
          next[slotId] = detail;
        });

        if (active) setPlayerDetails({ ...next });
      }

      if (active) setPlayerDetailsLoading(false);
    }

    void loadPlayerDetails();
    return () => { active = false; };
  }, [post]);

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
  const players = post.squad_data.players ?? {};
  const filledSlots = getGallerySlots(post.squad_data).filter((slot) => players[slot.slotId]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/squad/gallery" className="text-sm font-bold text-gray-400 hover:text-white">← 스쿼드 갤러리</Link>
        <button type="button" onClick={() => void toggleLike()} className={`rounded-xl border px-4 py-2.5 text-sm font-black transition ${liked ? "border-rose-300/40 bg-rose-400/10 text-rose-300" : "border-white/10 text-gray-300 hover:bg-white/5"}`}>
          {liked ? "♥ 좋아요 취소" : "♡ 좋아요"}
        </button>
      </div>

      <SquadFeedCard post={post} />

      <section className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-[#171b1f]">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 p-4 sm:p-5">
          <div>
            <p className="text-xs font-black tracking-[0.14em] text-lime-400">SQUAD PLAYERS</p>
            <h2 className="mt-1 text-2xl font-black">포함 선수</h2>
            <p className="mt-1 text-xs text-gray-500">이 스쿼드에 등록된 선수 {filledSlots.length}명을 리스트로 확인할 수 있습니다.</p>
          </div>
          {playerDetailsLoading && <span className="text-xs font-bold text-gray-500">선수 정보 불러오는 중...</span>}
        </div>

        <div className="hidden grid-cols-[76px_minmax(180px,1.5fr)_90px_80px_80px_minmax(140px,1fr)] gap-3 border-b border-white/[0.07] bg-black/10 px-4 py-2.5 text-[10px] font-black text-gray-500 md:grid sm:px-5">
          <span>선수</span>
          <span>이름 / 시즌</span>
          <span>포지션</span>
          <span>강화</span>
          <span>OVR / 급여</span>
          <span className="text-right">선수 가치</span>
        </div>

        <div className="divide-y divide-white/[0.07]">
          {filledSlots.map((slot) => {
            const player = players[slot.slotId]!;
            const detail = playerDetails[slot.slotId];
            const price = detail?.prices?.[Math.max(0, player.grade - 1)] ?? null;
            const displayOvr = detail?.positionOvr ?? player.ovr ?? null;

            return (
              <article key={slot.slotId} className="grid gap-3 px-4 py-3 transition hover:bg-white/[0.025] md:grid-cols-[76px_minmax(180px,1.5fr)_90px_80px_80px_minmax(140px,1fr)] md:items-center sm:px-5">
                <div className="relative h-20 w-16 overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_50%_20%,rgba(163,230,53,0.14),transparent_60%)] md:h-16 md:w-14">
                  <PlayerArtwork spid={player.artworkSpid ?? player.id} alt={player.name} className="absolute bottom-0 left-1/2 max-h-[76px] max-w-[145%] -translate-x-1/2 object-contain md:max-h-[62px]" />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-base font-black text-white" title={player.name}>{player.name}</p>
                  <p className="mt-1 truncate text-[11px] font-bold text-gray-500" title={player.seasonName ?? undefined}>{player.seasonName ?? "시즌 정보 없음"}</p>
                  {detail?.failed && <p className="mt-1 text-[9px] font-bold text-amber-300">일부 정보 로딩 실패</p>}
                </div>

                <div className="flex items-center gap-2 md:block">
                  <span className="text-[10px] font-bold text-gray-600 md:hidden">포지션</span>
                  <span className="inline-flex rounded-lg border border-lime-300/20 bg-lime-300/[0.07] px-2.5 py-1.5 text-xs font-black text-lime-300">{slot.label}</span>
                </div>

                <div className="flex items-center gap-2 md:block">
                  <span className="text-[10px] font-bold text-gray-600 md:hidden">강화</span>
                  <span className="text-sm font-black text-white">{player.grade}강</span>
                </div>

                <div className="flex items-center gap-3 text-xs font-black md:block">
                  <span className="text-lime-300">OVR {displayOvr ?? "-"}</span>
                  <span className="text-gray-400 md:mt-1 md:block">급여 {detail?.salary ?? "-"}</span>
                </div>

                <div className="flex items-center justify-between gap-3 md:block md:text-right">
                  <span className="text-[10px] font-bold text-gray-600 md:block">{player.grade}강 가격</span>
                  <span className="text-sm font-black text-white md:mt-1 md:block" title={price ?? undefined}>{detail ? formatPlayerPrice(price) : "불러오는 중..."}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

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
