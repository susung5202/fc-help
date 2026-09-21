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

  function copySquad() {
    window.localStorage.setItem("fc-help-squad-v1", JSON.stringify(post.squad_data));
    router.push("/squad");
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-[#171b1f] shadow-xl">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <Link href={`/squad/gallery/${post.id}`} className="block truncate text-lg font-black text-white hover:text-lime-300">
            {post.title}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500">
            <span className="font-bold text-gray-300">{post.author_name}</span>
            <span>·</span>
            <span>{timeAgo(post.created_at)}</span>
            <span>·</span>
            <span>조회 {post.views.toLocaleString("ko-KR")}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copySquad}
            className="rounded-lg border border-lime-400/30 bg-lime-400/10 px-3 py-2 text-xs font-black text-lime-300 transition hover:bg-lime-400/20"
          >
            스쿼드 복사
          </button>
          <Link
            href={`/squad/gallery/${post.id}`}
            className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-300 transition hover:bg-white/5 hover:text-white"
          >
            자세히
          </Link>
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,300px)_1fr] sm:p-5">
        <Link
          href={`/squad/gallery/${post.id}`}
          className="relative mx-auto aspect-[0.72] w-full max-w-[300px] overflow-hidden rounded-xl border border-white/15 bg-[repeating-linear-gradient(180deg,#17612d_0%,#17612d_16.66%,#135526_16.66%,#135526_33.33%)]"
        >
          <div className="pointer-events-none absolute inset-3 opacity-40">
            <div className="absolute inset-0 border border-white/60" />
            <div className="absolute left-0 right-0 top-1/2 border-t border-white/60" />
            <div className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60" />
            <div className="absolute left-1/2 top-0 h-[16%] w-[56%] -translate-x-1/2 border-x border-b border-white/60" />
            <div className="absolute bottom-0 left-1/2 h-[16%] w-[56%] -translate-x-1/2 border-x border-t border-white/60" />
          </div>

          {slots.map((slot) => {
            const player = players[slot.slotId];
            if (!player) return null;
            return (
              <div
                key={slot.slotId}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                title={`${slot.label} · ${player.name} · ${player.grade}강`}
              >
                <div className="relative h-10 w-9 overflow-hidden rounded-md border border-white/20 bg-black/25 shadow-md sm:h-12 sm:w-10">
                  <PlayerArtwork
                    spid={player.artworkSpid ?? player.id}
                    alt={player.name}
                    className="absolute bottom-0 left-1/2 max-h-[44px] max-w-[135%] -translate-x-1/2 object-contain"
                  />
                  <span className="absolute bottom-0 right-0 rounded-tl bg-black/75 px-1 text-[7px] font-black text-lime-200">
                    +{player.grade}
                  </span>
                </div>
                <span className="mt-0.5 max-w-14 truncate rounded bg-black/70 px-1 text-[7px] font-bold text-white">
                  {player.name}
                </span>
              </div>
            );
          })}
        </Link>

        <div className="min-w-0">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="포메이션" value={post.formation} />
            <Stat label="급여" value={post.total_salary ? `${post.total_salary}/310` : "-"} />
            <Stat label="평균 OVR" value={post.average_ovr == null ? "-" : String(post.average_ovr)} />
            <Stat label="구단가치" value={formatGalleryValue(post.total_value)} />
          </div>

          {post.description && (
            <p className="mt-4 line-clamp-3 text-sm leading-6 text-gray-300">{post.description}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-1.5">
            {post.team_colors.slice(0, 4).map((teamColor) => (
              <span key={teamColor} className="rounded-full border border-lime-400/20 bg-lime-400/[0.06] px-2.5 py-1 text-[10px] font-bold text-lime-200">
                {teamColor}
              </span>
            ))}
            {post.player_names.slice(0, Math.max(0, 4 - post.team_colors.length)).map((name) => (
              <span key={name} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-gray-300">
                {name}
              </span>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-4 border-t border-white/10 pt-4 text-xs font-bold text-gray-400">
            <span>♥ {post.likes_count.toLocaleString("ko-KR")}</span>
            <span>댓글 {post.comments_count.toLocaleString("ko-KR")}</span>
            <span className="ml-auto text-gray-600">선수 {Object.keys(players).length}/11</span>
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
