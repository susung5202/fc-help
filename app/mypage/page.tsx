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

type Profile = {
  id: string;
  username: string | null;
  display_name: string;
  bio: string;
  avatar_url: string | null;
  fconline_nickname: string | null;
  fconline_ouid: string | null;
};

type MySquad = {
  id: string;
  title: string;
  formation: string;
  squad_data: GallerySquadData;
  total_value: string | number;
  views: number;
  likes_count: number;
  comments_count: number;
  created_at: string;
};

type FcOnlineProfile = {
  ouid: string;
  nickname: string;
  level: number | null;
  divisionId: number | null;
  divisionName: string | null;
  tierSource: "latest_match" | "historical_best" | null;
  lastMatchDate: string | null;
  matchType: number;
};

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

function makeFallbackUsername(userId: string) {
  return `user_${userId.replace(/-/g, "").slice(0, 8)}`;
}

function formatShortDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value.endsWith("Z") ? value : `${value}Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function MyPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [squads, setSquads] = useState<MySquad[]>([]);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [bioInput, setBioInput] = useState("");
  const [fcNicknameInput, setFcNicknameInput] = useState("");
  const [fcProfile, setFcProfile] = useState<FcOnlineProfile | null>(null);
  const [fcLoading, setFcLoading] = useState(false);
  const [fcError, setFcError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setMessage("");
      const { data: authData, error: authError } = await supabase.auth.getUser();
      const user = authData.user;

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const fallbackDisplayName = String(
        user.user_metadata?.display_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "구단주"
      ).slice(0, 20);
      const fallbackUsername = makeFallbackUsername(user.id);

      const [{ data: profileData, error: profileError }, { data: squadData, error: squadError }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id,username,display_name,bio,avatar_url,fconline_nickname,fconline_ouid")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("squad_posts")
            .select("id,title,formation,squad_data,total_value,views,likes_count,comments_count,created_at")
            .eq("author_id", user.id)
            .order("created_at", { ascending: false })
            .limit(60),
        ]);

      if (!active) return;

      let loadedProfile = profileData as Profile | null;
      if (!loadedProfile && !profileError) {
        const { data: createdProfile, error: createError } = await supabase
          .from("profiles")
          .upsert({
            id: user.id,
            username: fallbackUsername,
            display_name: fallbackDisplayName,
            bio: "",
          })
          .select("id,username,display_name,bio,avatar_url,fconline_nickname,fconline_ouid")
          .single();
        if (!createError) loadedProfile = createdProfile as Profile;
      }

      if (!loadedProfile) {
        loadedProfile = {
          id: user.id,
          username: fallbackUsername,
          display_name: fallbackDisplayName,
          bio: "",
          avatar_url: null,
          fconline_nickname: null,
          fconline_ouid: null,
        };
      }

      setUserId(user.id);
      setEmail(user.email ?? "");
      setProfile(loadedProfile);
      setUsernameInput(loadedProfile.username ?? fallbackUsername);
      setDisplayNameInput(loadedProfile.display_name || fallbackDisplayName);
      setBioInput(loadedProfile.bio ?? "");
      setFcNicknameInput(loadedProfile.fconline_nickname ?? "");
      setSquads((squadData ?? []) as MySquad[]);

      if (profileError || squadError) {
        setMessage(profileError?.message || squadError?.message || "프로필을 불러오지 못했습니다.");
      }
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  useEffect(() => {
    const nickname = profile?.fconline_nickname?.trim();
    if (!nickname) {
      setFcProfile(null);
      setFcError("");
      setFcLoading(false);
      return;
    }
    const linkedNickname = nickname;

    let active = true;

    async function loadFcOnlineProfile() {
      setFcLoading(true);
      setFcError("");
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        if (active) {
          setFcError("FC Online 정보를 조회하려면 다시 로그인해주세요.");
          setFcLoading(false);
        }
        return;
      }

      try {
        const response = await fetch(`/api/fconline/profile?nickname=${encodeURIComponent(linkedNickname)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        const payload = (await response.json()) as FcOnlineProfile & { error?: string };
        if (!response.ok) throw new Error(payload.error || "FC Online 정보를 불러오지 못했습니다.");
        if (!active) return;
        setFcProfile(payload);

        if (userId && payload.ouid && profile?.fconline_ouid !== payload.ouid) {
          await supabase.from("profiles").update({ fconline_ouid: payload.ouid }).eq("id", userId);
        }
      } catch (error) {
        if (!active) return;
        setFcProfile(null);
        setFcError(error instanceof Error ? error.message : "FC Online 정보를 불러오지 못했습니다.");
      } finally {
        if (active) setFcLoading(false);
      }
    }

    void loadFcOnlineProfile();
    return () => {
      active = false;
    };
  }, [profile?.fconline_nickname, profile?.fconline_ouid, supabase, userId]);

  const totalLikes = useMemo(
    () => squads.reduce((sum, squad) => sum + Number(squad.likes_count || 0), 0),
    [squads]
  );
  const totalComments = useMemo(
    () => squads.reduce((sum, squad) => sum + Number(squad.comments_count || 0), 0),
    [squads]
  );

  async function saveProfile() {
    if (!userId || !profile) return;
    const username = usernameInput.trim().replace(/^@/, "").toLowerCase();
    const displayName = displayNameInput.trim();
    const bio = bioInput.trim();
    const fcNickname = fcNicknameInput.trim();

    if (!USERNAME_PATTERN.test(username)) {
      setMessage("아이디는 영문 소문자, 숫자, 밑줄(_)만 사용해 3~20자로 입력해주세요.");
      return;
    }
    if (!displayName || displayName.length > 20) {
      setMessage("닉네임은 1~20자로 입력해주세요.");
      return;
    }
    if (bio.length > 150) {
      setMessage("소개는 150자까지 입력할 수 있습니다.");
      return;
    }
    if (fcNickname.length > 30) {
      setMessage("FC Online 닉네임을 확인해주세요.");
      return;
    }

    setSaving(true);
    setMessage("");
    const { data, error } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        username,
        display_name: displayName,
        bio,
        fconline_nickname: fcNickname || null,
        fconline_ouid: fcNickname === profile.fconline_nickname ? profile.fconline_ouid : null,
        updated_at: new Date().toISOString(),
      })
      .select("id,username,display_name,bio,avatar_url,fconline_nickname,fconline_ouid")
      .single();

    if (error) {
      setMessage(error.code === "23505" ? "이미 사용 중인 아이디입니다." : error.message);
      setSaving(false);
      return;
    }

    await Promise.all([
      supabase.auth.updateUser({ data: { display_name: displayName } }),
      supabase.from("squad_posts").update({ author_name: displayName }).eq("author_id", userId),
    ]);

    setProfile(data as Profile);
    setEditing(false);
    setSaving(false);
    setMessage("프로필을 저장했습니다.");
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (loading || !profile) {
    return (
      <main className="min-h-screen bg-[#0f1115] px-4 py-16 text-center text-sm text-gray-500">
        마이페이지를 불러오는 중...
      </main>
    );
  }

  const profileInitial = (profile.display_name || profile.username || "F").trim().slice(0, 1).toUpperCase();
  const tierDate = formatShortDate(fcProfile?.lastMatchDate ?? null);

  return (
    <main className="min-h-screen bg-[#0f1115] text-white">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
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
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                <h1 className="truncate text-xl font-black tracking-tight sm:text-2xl">{profile.display_name}</h1>
                <button type="button" onClick={() => setEditing(true)} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-black text-gray-100 transition hover:bg-white/15">
                  프로필 편집
                </button>
                <button type="button" onClick={() => void logout()} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-500 transition hover:bg-white/5 hover:text-gray-300">
                  로그아웃
                </button>
              </div>

              <p className="mt-1 text-sm font-bold text-gray-400">@{profile.username ?? makeFallbackUsername(userId)}</p>

              <div className="mt-5 flex max-w-sm justify-between gap-4 text-center sm:justify-start sm:gap-10 sm:text-left">
                <div><p className="text-base font-black sm:text-lg">{squads.length}</p><p className="text-[11px] text-gray-500">스쿼드</p></div>
                <div><p className="text-base font-black sm:text-lg">{totalLikes.toLocaleString("ko-KR")}</p><p className="text-[11px] text-gray-500">받은 좋아요</p></div>
                <div><p className="text-base font-black sm:text-lg">{totalComments.toLocaleString("ko-KR")}</p><p className="text-[11px] text-gray-500">받은 댓글</p></div>
              </div>

              {profile.bio ? (
                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-200">{profile.bio}</p>
              ) : (
                <p className="mt-4 text-sm text-gray-600">프로필 편집에서 자기소개를 추가할 수 있습니다.</p>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-[#171b1f] p-4 sm:ml-[168px] sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black tracking-[0.16em] text-lime-400">FC ONLINE</p>
                {profile.fconline_nickname ? (
                  <p className="mt-1 text-lg font-black">{fcProfile?.nickname ?? profile.fconline_nickname}</p>
                ) : (
                  <p className="mt-1 text-sm font-bold text-gray-400">FC Online 구단주를 연결해보세요.</p>
                )}
              </div>
              {profile.fconline_nickname && (
                <button type="button" onClick={() => setEditing(true)} className="text-xs font-black text-lime-300">연동 수정 →</button>
              )}
            </div>

            {!profile.fconline_nickname ? (
              <button type="button" onClick={() => setEditing(true)} className="mt-4 rounded-xl bg-lime-300 px-4 py-2.5 text-xs font-black text-black transition hover:bg-lime-200">
                FC Online 닉네임 연결
              </button>
            ) : fcLoading ? (
              <p className="mt-4 text-xs font-bold text-gray-500">공식경기 정보를 불러오는 중...</p>
            ) : fcError ? (
              <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 px-3 py-2.5 text-xs text-amber-200">{fcError}</p>
            ) : fcProfile ? (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="rounded-xl bg-black/20 p-3">
                  <p className="text-[9px] font-bold text-gray-600">구단주 레벨</p>
                  <p className="mt-1 text-sm font-black">{fcProfile.level == null ? "-" : `Lv. ${fcProfile.level}`}</p>
                </div>
                <div className="rounded-xl bg-black/20 p-3 sm:col-span-2">
                  <p className="text-[9px] font-bold text-gray-600">1대1 공식경기</p>
                  <p className="mt-1 text-sm font-black text-lime-300">{fcProfile.divisionName ?? "등급 기록 없음"}</p>
                  {fcProfile.tierSource && (
                    <p className="mt-1 text-[9px] text-gray-600">
                      {fcProfile.tierSource === "latest_match" ? "최근 공식경기 기준" : "최근 등급 정보를 확인할 수 없어 역대 최고 등급 표시"}
                      {tierDate ? ` · ${tierDate}` : ""}
                    </p>
                  )}
                </div>
              </div>
            ) : null}

            <p className="mt-3 text-[9px] text-gray-700">Data based on NEXON Open API</p>
          </div>
        </section>

        {message && (
          <button type="button" onClick={() => setMessage("")} className="mt-4 w-full rounded-xl border border-lime-300/15 bg-lime-300/5 px-4 py-3 text-left text-xs text-lime-100">
            {message}
          </button>
        )}

        <section className="pt-5 sm:pt-7">
          <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2 text-xs font-black text-white">
              <span className="grid h-5 w-5 grid-cols-2 gap-[2px]">
                <i className="bg-current" /><i className="bg-current" /><i className="bg-current" /><i className="bg-current" />
              </span>
              스쿼드
            </div>
            <Link href="/squad/maker" className="rounded-lg bg-lime-300 px-3 py-2 text-[11px] font-black text-black transition hover:bg-lime-200">
              + 새 스쿼드
            </Link>
          </div>

          {squads.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-lg font-black text-gray-300">아직 올린 스쿼드가 없습니다.</p>
              <Link href="/squad/maker" className="mt-3 inline-block text-sm font-black text-lime-300">첫 스쿼드 만들기 →</Link>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1 sm:gap-2">
              {squads.map((squad) => (
                <SquadGridItem key={squad.id} squad={squad} />
              ))}
            </div>
          )}
        </section>
      </div>

      {editing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={() => !saving && setEditing(false)}>
          <div className="max-h-[90svh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/15 bg-[#151817] p-5 shadow-2xl sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black tracking-[0.14em] text-lime-400">PROFILE</p>
                <h2 className="mt-1 text-2xl font-black">프로필 편집</h2>
              </div>
              <button type="button" disabled={saving} onClick={() => setEditing(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-2xl text-gray-400">×</button>
            </div>

            <label className="mt-6 block text-xs font-bold text-gray-400">FC Help 아이디</label>
            <div className="mt-2 flex items-center rounded-xl border border-white/10 bg-[#0f1115] px-3 focus-within:border-lime-300/40">
              <span className="text-sm font-bold text-gray-600">@</span>
              <input value={usernameInput} onChange={(event) => setUsernameInput(event.target.value.toLowerCase())} maxLength={20} className="min-w-0 flex-1 bg-transparent px-1 py-3 text-sm outline-none" placeholder="fchelp_id" />
            </div>
            <p className="mt-1 text-[10px] text-gray-600">영문 소문자, 숫자, 밑줄(_) · 3~20자</p>

            <label className="mt-4 block text-xs font-bold text-gray-400">닉네임</label>
            <input value={displayNameInput} onChange={(event) => setDisplayNameInput(event.target.value)} maxLength={20} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-sm outline-none focus:border-lime-300/40" />

            <label className="mt-4 block text-xs font-bold text-gray-400">자기소개</label>
            <textarea value={bioInput} onChange={(event) => setBioInput(event.target.value)} maxLength={150} rows={4} placeholder="스쿼드 취향이나 한마디를 적어보세요." className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-sm leading-6 outline-none focus:border-lime-300/40" />
            <p className="mt-1 text-right text-[10px] text-gray-600">{bioInput.length}/150</p>

            <div className="mt-5 rounded-2xl border border-lime-300/15 bg-lime-300/[0.04] p-4">
              <p className="text-xs font-black text-lime-300">FC Online 연동</p>
              <label className="mt-3 block text-[10px] font-bold text-gray-500">구단주 닉네임</label>
              <input value={fcNicknameInput} onChange={(event) => setFcNicknameInput(event.target.value)} maxLength={30} placeholder="FC Online 닉네임" className="mt-2 w-full rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-sm outline-none focus:border-lime-300/40" />
              <p className="mt-2 text-[10px] leading-5 text-gray-600">저장하면 NEXON Open API에서 구단주 정보와 1대1 공식경기 등급을 조회합니다. 빈칸으로 저장하면 연동이 해제됩니다.</p>
            </div>

            <div className="mt-4 rounded-xl bg-black/20 px-3 py-2 text-[10px] text-gray-600">로그인 이메일 · {email}</div>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" disabled={saving} onClick={() => setEditing(false)} className="rounded-xl border border-white/10 py-3 text-sm font-bold text-gray-400 disabled:opacity-50">취소</button>
              <button type="button" disabled={saving} onClick={() => void saveProfile()} className="rounded-xl bg-lime-300 py-3 text-sm font-black text-black disabled:opacity-50">
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SquadGridItem({ squad }: { squad: MySquad }) {
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