"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PlayerArtwork from "@/components/PlayerArtwork";
import { createClient } from "@/lib/supabase/client";
import {
  formatGalleryValue,
  getGallerySlots,
  type GallerySquadData,
} from "@/lib/fconline/squadGallery";

type PublicProfileData = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  fconline_nickname: string | null;
};

type PublicSquad = {
  id: string;
  title: string;
  formation: string;
  squad_data: GallerySquadData;
  total_value: string | number;
  likes_count: number;
  comments_count: number;
  created_at: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function PublicProfile({ username }: { username: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [squads, setSquads] = useState<PublicSquad[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setMessage("");

      const lookup = username.trim().replace(/^@/, "").toLowerCase();
      let profileQuery = supabase
        .from("profiles")
        .select("id,username,display_name,bio,avatar_url,fconline_nickname");

      profileQuery = UUID_PATTERN.test(lookup)
        ? profileQuery.eq("id", lookup)
        : profileQuery.eq("username", lookup);

      const { data: profileData, error: profileError } = await profileQuery.maybeSingle();
      if (!active) return;

      if (profileError || !profileData) {
        setProfile(null);
        setSquads([]);
        setMessage(profileError?.message || "프로필을 찾을 수 없습니다.");
        setLoading(false);
        return;
      }

      const loadedProfile = profileData as PublicProfileData;
      const [{ data: squadData, error: squadError }, { data: authData }] = await Promise.all([
        supabase
          .from("squad_posts")
          .select("id,title,formation,squad_data,total_value,likes_count,comments_count,created_at")
          .eq("author_id", loadedProfile.id)
          .eq("is_public", true)
          .order("created_at", { ascending: false })
          .limit(60),
        supabase.auth.getUser(),
      ]);

      if (!active) return;

      setProfile(loadedProfile);
      setSquads((squadData ?? []) as PublicSquad[]);
      setViewerId(authData.user?.id ?? null);
      if (squadError) setMessage(squadError.message);
      setLoading(false);

      if (UUID_PATTERN.test(lookup) && loadedProfile.username) {
        router.replace(`/profile/${encodeURIComponent(loadedProfile.username)}`);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [router, supabase, username]);

  const totalLikes = useMemo(
    () => squads.reduce((sum, squad) => sum + Number(squad.likes_count || 0), 0),
    [squads]
  );
  const totalComments = useMemo(
    () => squads.reduce((sum, squad) => sum + Number(squad.comments_count || 0), 0),
    [squads]
  );

  if (loading) {
    return <div className="mx-auto max-w-5xl px-4 py-16 text-center text-sm text-gray-500">프로필을 불러오는 중...</div>;
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-20 text-center">
        <p className="text-lg font-black text-gray-300">프로필을 찾을 수 없습니다.</p>
        {message && <p className="mt-2 text-xs text-gray-600">{message}</p>}
        <Link href="/squad/gallery" className="mt-4 inline-block text-sm font-black text-lime-300">스쿼드 갤러리로 돌아가기 →</Link>
      </div>
    );
  }

  const profileInitial = (profile.display_name || profile.username || "F").trim().slice(0, 1).toUpperCase();
  const isOwner = viewerId === profile.id;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link href="/squad/gallery" className="text-sm font-bold text-gray-400 transition hover:text-white">← 스쿼드 갤러리</Link>
        {isOwner && (
          <Link href="/mypage" className="rounded-lg bg-white/10 px-3 py-2 text-xs font-black text-gray-100 transition hover:bg-white/15">
            내 프로필 편집
          </Link>
        )}
      </div>

      <section className="border-b border-white/10 pb-7 sm:pb-9">
        <div className="flex items-start gap-5 sm:gap-10">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-gradient-to-br from-lime-300/25 via-[#1d2920] to-[#111318] text-3xl font-black text-lime-200 sm:h-32 sm:w-32 sm:text-5xl">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={`${profile.display_name} 프로필`} className="h-full w-full object-cover" />
            ) : (
              profileInitial
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">{profile.display_name}</h1>
            <p className="mt-1 text-sm font-bold text-gray-400">@{profile.username}</p>

            <div className="mt-5 flex max-w-sm justify-between gap-4 text-center sm:justify-start sm:gap-10 sm:text-left">
              <div><p className="text-base font-black sm:text-lg">{squads.length}</p><p className="text-[11px] text-gray-500">스쿼드</p></div>
              <div><p className="text-base font-black sm:text-lg">{totalLikes.toLocaleString("ko-KR")}</p><p className="text-[11px] text-gray-500">받은 좋아요</p></div>
              <div><p className="text-base font-black sm:text-lg">{totalComments.toLocaleString("ko-KR")}</p><p className="text-[11px] text-gray-500">받은 댓글</p></div>
            </div>

            {profile.bio ? (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-200">{profile.bio}</p>
            ) : (
              <p className="mt-4 text-sm text-gray-600">등록된 자기소개가 없습니다.</p>
            )}
          </div>
        </div>

        {profile.fconline_nickname && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-[#171b1f] p-4 sm:ml-[168px] sm:p-5">
            <p className="text-[10px] font-black tracking-[0.16em] text-lime-400">FC ONLINE</p>
            <p className="mt-1 text-lg font-black">{profile.fconline_nickname}</p>
            <p className="mt-1 text-[10px] text-gray-600">연동된 FC Online 구단주 닉네임</p>
          </div>
        )}
      </section>

      {message && (
        <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/5 px-4 py-3 text-xs text-amber-100">{message}</div>
      )}

      <section className="pt-5 sm:pt-7">
        <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2 text-xs font-black text-white">
            <span className="grid h-5 w-5 grid-cols-2 gap-[2px]">
              <i className="bg-current" /><i className="bg-current" /><i className="bg-current" /><i className="bg-current" />
            </span>
            공개 스쿼드
          </div>
          <span className="text-[11px] font-bold text-gray-600">{squads.length}개</span>
        </div>

        {squads.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-lg font-black text-gray-300">공개한 스쿼드가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            {squads.map((squad) => (
              <PublicSquadGridItem key={squad.id} squad={squad} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function PublicSquadGridItem({ squad }: { squad: PublicSquad }) {
  const players = squad.squad_data?.players ?? {};
  const slots = getGallerySlots(squad.squad_data ?? {}).filter((slot) => players[slot.slotId]);

  return (
    <Link href={`/squad/gallery/${squad.id}`} className="group relative aspect-square overflow-hidden bg-[#155527]">
      <div className="absolute inset-0 bg-[repeating-linear-gradient(180deg,#17612d_0%,#17612d_16.66%,#135526_16.66%,#135526_33.33%)]" />
      <div className="pointer-events-none absolute inset-[7%] opacity-25">
        <div className="absolute inset-0 border border-white" />
        <div className="absolute left-0 right-0 top-1/2 border-t border-white" />
        <div className="absolute left-1/2 top-1/2 h-[18%] w-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white" />
      </div>

      {slots.map((slot) => {
        const player = players[slot.slotId]!;
        return (
          <div key={slot.slotId} className="absolute h-[15%] w-[13%] -translate-x-1/2 -translate-y-1/2" style={{ left: `${slot.x}%`, top: `${slot.y}%` }}>
            <PlayerArtwork spid={player.artworkSpid ?? player.id} alt={player.name} className="absolute bottom-0 left-1/2 max-h-full max-w-[150%] -translate-x-1/2 object-contain drop-shadow-[0_2px_2px_rgba(0,0,0,0.55)]" />
          </div>
        );
      })}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-2 pb-2 pt-8 sm:px-3 sm:pb-3">
        <p className="truncate text-[10px] font-black text-white sm:text-sm">{squad.title}</p>
        <p className="mt-0.5 hidden truncate text-[9px] font-bold text-gray-300 sm:block">{squad.formation} · {formatGalleryValue(squad.total_value)}</p>
        <div className="mt-1 flex gap-2 text-[8px] font-bold text-white/70 sm:text-[9px]">
          <span>♥ {squad.likes_count}</span><span>댓글 {squad.comments_count}</span>
        </div>
      </div>
      <div className="absolute inset-0 bg-white/0 transition group-hover:bg-white/[0.04]" />
    </Link>
  );
}
