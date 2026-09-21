"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import PlayerArtwork from "@/components/PlayerArtwork";
import {
  formatGalleryValue,
  getGallerySlots,
  type GallerySquadData,
} from "@/lib/fconline/squadGallery";

export type SquadFeedPost = {
  id: string;
  author_name: string;
  title: string;
  description: string;
  formation: string;
  squad_data: GallerySquadData;
  player_names: string[];
  team_colors: string[];
  total_salary: number;
  total_value: string | number;
  average_ovr: number | null;
  likes_count: number;
  comments_count: number;
  views: number;
  created_at: string;
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

export default function SquadFeedCard({ post }: { post: SquadFeedPost }) {
  const router = useRouter();
  const players = post.squad_data.players ?? {};
  const slots = getGallerySlots(post.squad_data);
  const filledSlots = slots.filter((slot) => players[slot.slotId]);

  function copySquad() {
    window.localStorage.setItem("fc-help-squad-v1", JSON.stringify(post.squad_data));
    router.push("/squad");
  }

  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-[#171b1f] shadow-[0_20px_70px_rgba(0,0,0,0.24)]">
      <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="min-w-0">
          <Link href={`/squad/gallery/${post.id}`} className="block truncate text-xl font-black tracking-tight text-white transition hover:text-lime-300 sm:text-2xl">
            {post.title}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500">
            <span className="font-bold text-gray-300">{post.author_name}</span>
            <span>·</span>
            <span>{timeAgo(post.created_at)}</span>
            <span>·</span>
            <span>조회 {post.views.toLocaleString("ko-KR")}</span>
            <span>·</span>
            <span>선수 {filledSlots.length}/11</span>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={copySquad} className="rounded-xl border border-lime-400/30 bg-lime-400/10 px-3.5 py-2.5 text-xs font-black text-lime-300 transition hover:bg-lime-400/20">
            스쿼드 복사
          </button>
          <Link href={`/squad/gallery/${post.id}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs font-black text-gray-200 transition hover:bg-white/[0.07] hover:text-white">
            자세히
          </Link>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <Link
          href={`/squad/gallery/${post.id}`}
          className="relative mx-auto block aspect-[0.9] w-full max-w-[760px] overflow-hidden rounded-3xl border border-white/15 bg-[repeating-linear-gradient(180deg,#17612d_0%,#17612d_16.66%,#135526_16.66%,#135526_33.33%)] shadow-inner sm:aspect-[1.05] lg:max-w-[860px]"
        >
          <div className="pointer-events-none absolute inset-5 opacity-35 sm:inset-7">
            <div className="absolute inset-0 border border-white/70" />
            <div className="absolute left-0 right-0 top-1/2 border-t border-white/70" />
            <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 sm:h-24 sm:w-24" />
            <div className="absolute left-1/2 top-0 h-[16%] w-[56%] -translate-x-1/2 border-x border-b border-white/70" />
            <div className="absolute bottom-0 left-1/2 h-[16%] w-[56%] -translate-x-1/2 border-x border-t border-white/70" />
          </div>

          {filledSlots.map((slot) => {
            const player = players[slot.slotId]!;
            return (
              <div
                key={slot.slotId}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                title={`${slot.label} · ${player.name} · ${player.grade}강`}
              >
                <div className="relative h-14 w-12 overflow-hidden rounded-xl border border-white/25 bg-black/30 shadow-xl sm:h-[72px] sm:w-[62px] lg:h-[82px] lg:w-[70px]">
                  <PlayerArtwork
                    spid={player.artworkSpid ?? player.id}
                    alt={player.name}
                    className="absolute bottom-0 left-1/2 max-h-[68px] max-w-[145%] -translate-x-1/2 object-contain sm:max-h-[86px] lg:max-h-[96px]"
                  />
                  <span className="absolute bottom-0 right-0 rounded-tl bg-black/80 px-1.5 py-0.5 text-[9px] font-black text-lime-200 sm:text-[10px]">+{player.grade}</span>
                </div>
                <span className="mt-1 max-w-24 truncate rounded-md bg-black/80 px-2 py-0.5 text-[9px] font-black text-white sm:max-w-32 sm:text-[11px]">{player.name}</span>
                <span className="mt-0.5 rounded bg-black/75 px-1.5 py-0.5 text-[8px] font-black text-lime-200 sm:text-[9px]">{slot.label}</span>
              </div>
            );
          })}
        </Link>

        <div className="mx-auto mt-5 max-w-[860px]">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="포메이션" value={post.formation} />
            <Stat label="급여" value={post.total_salary ? `${post.total_salary}/310` : "-"} />
            <Stat label="평균 OVR" value={post.average_ovr == null ? "-" : String(post.average_ovr)} />
            <Stat label="구단가치" value={formatGalleryValue(post.total_value)} />
          </div>

          {post.description && (
            <p className="mt-4 line-clamp-3 rounded-2xl border border-white/[0.07] bg-black/10 px-4 py-3 text-sm leading-6 text-gray-300">
              {post.description}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-1.5">
            {post.team_colors.slice(0, 6).map((teamColor) => (
              <span key={teamColor} className="rounded-full border border-lime-400/20 bg-lime-400/[0.06] px-2.5 py-1 text-[10px] font-bold text-lime-200">{teamColor}</span>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-4 border-t border-white/10 pt-4 text-xs font-bold text-gray-400">
            <span>♥ {post.likes_count.toLocaleString("ko-KR")}</span>
            <span>댓글 {post.comments_count.toLocaleString("ko-KR")}</span>
            <Link href={`/squad/gallery/${post.id}`} className="ml-auto rounded-lg bg-lime-300 px-3 py-2 font-black text-black transition hover:bg-lime-200">자세히 보기</Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/15 px-3 py-2.5">
      <p className="text-[9px] font-bold text-gray-500">{label}</p>
      <p className="mt-0.5 truncate text-xs font-black text-white" title={value}>{value}</p>
    </div>
  );
}
