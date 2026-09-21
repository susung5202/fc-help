"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import SquadFeedCard, { type SquadFeedPost } from "@/components/SquadFeedCard";

type ValueRange =
  | "all"
  | "under50m"
  | "50m-100m"
  | "100m-1b"
  | "1b-3b"
  | "3b-5b"
  | "5b-10b"
  | "over10b";

const VALUE_50M = BigInt("50000000");
const VALUE_100M = BigInt("100000000");
const VALUE_1B = BigInt("1000000000");
const VALUE_3B = BigInt("3000000000");
const VALUE_5B = BigInt("5000000000");
const VALUE_10B = BigInt("10000000000");

function parseSquadValue(value: string | number) {
  const text = String(value ?? "").replace(/[^0-9]/g, "");
  if (!text) return null;
  try {
    return BigInt(text);
  } catch {
    return null;
  }
}

function matchesValueRange(value: string | number, range: ValueRange) {
  if (range === "all") return true;
  const amount = parseSquadValue(value);
  if (amount == null) return false;
  if (range === "under50m") return amount < VALUE_50M;
  if (range === "50m-100m") return amount >= VALUE_50M && amount < VALUE_100M;
  if (range === "100m-1b") return amount >= VALUE_100M && amount < VALUE_1B;
  if (range === "1b-3b") return amount >= VALUE_1B && amount < VALUE_3B;
  if (range === "3b-5b") return amount >= VALUE_3B && amount < VALUE_5B;
  if (range === "5b-10b") return amount >= VALUE_5B && amount < VALUE_10B;
  return amount >= VALUE_10B;
}

export default function SquadGallery() {
  const supabase = useMemo(() => createClient(), []);
  const [posts, setPosts] = useState<SquadFeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [playerQuery, setPlayerQuery] = useState("");
  const [teamColorQuery, setTeamColorQuery] = useState("");
  const [valueRange, setValueRange] = useState<ValueRange>("all");
  const [sort, setSort] = useState<"latest" | "popular">("latest");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      let request = supabase
        .from("squad_posts")
        .select("id,author_name,title,description,formation,squad_data,player_names,team_colors,total_salary,total_value,average_ovr,likes_count,comments_count,views,created_at")
        .eq("is_public", true)
        .limit(100);

      request = sort === "popular"
        ? request.order("likes_count", { ascending: false }).order("created_at", { ascending: false })
        : request.order("created_at", { ascending: false });

      const { data, error: loadError } = await request;
      if (!active) return;
      if (loadError) {
        setError(loadError.message);
        setPosts([]);
      } else {
        setPosts((data ?? []) as SquadFeedPost[]);
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [sort, supabase]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const playerNeedle = playerQuery.trim().toLowerCase();
    const teamColorNeedle = teamColorQuery.trim().toLowerCase();

    return posts.filter((post) => {
      if (needle) {
        const matchesGeneral = [
          post.title,
          post.description,
          post.author_name,
          post.formation,
          ...(post.player_names ?? []),
          ...(post.team_colors ?? []),
        ].some((value) => String(value ?? "").toLowerCase().includes(needle));
        if (!matchesGeneral) return false;
      }

      if (playerNeedle && !(post.player_names ?? []).some((name) => name.toLowerCase().includes(playerNeedle))) {
        return false;
      }

      if (teamColorNeedle && !(post.team_colors ?? []).some((name) => name.toLowerCase().includes(teamColorNeedle))) {
        return false;
      }

      return matchesValueRange(post.total_value, valueRange);
    });
  }, [playerQuery, posts, query, teamColorQuery, valueRange]);

  const activeFilterCount = [
    playerQuery.trim(),
    teamColorQuery.trim(),
    valueRange !== "all" ? valueRange : "",
  ].filter(Boolean).length;

  function resetFilters() {
    setPlayerQuery("");
    setTeamColorQuery("");
    setValueRange("all");
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black tracking-[0.18em] text-lime-400">SQUAD GALLERY</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">스쿼드 갤러리</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
            다른 구단주의 스쿼드를 구경하고, 마음에 드는 스쿼드는 그대로 복사해서 내 스쿼드로 수정할 수 있습니다.
          </p>
        </div>
        <Link href="/squad" className="rounded-xl bg-lime-300 px-4 py-3 text-center text-sm font-black text-black transition hover:bg-lime-200">
          내 스쿼드 만들기
        </Link>
      </div>

      <div className="mt-7 rounded-2xl border border-white/10 bg-[#171b1f] p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="제목, 작성자, 선수, 팀컬러 통합 검색"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-lime-400/50"
          />

          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-black transition ${
              showFilters || activeFilterCount > 0
                ? "border-lime-300/40 bg-lime-300/10 text-lime-300"
                : "border-white/10 text-gray-300 hover:bg-white/5"
            }`}
          >
            필터
            {activeFilterCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-lime-300 px-1.5 text-[10px] text-black">
                {activeFilterCount}
              </span>
            )}
            <span className={`text-[9px] transition ${showFilters ? "rotate-180" : ""}`}>▼</span>
          </button>

          <div className="grid grid-cols-2 gap-2 sm:w-56">
            <button type="button" onClick={() => setSort("latest")} className={`rounded-xl border px-3 py-3 text-sm font-black transition ${sort === "latest" ? "border-lime-300/40 bg-lime-300/10 text-lime-300" : "border-white/10 text-gray-400 hover:bg-white/5"}`}>
              최신
            </button>
            <button type="button" onClick={() => setSort("popular")} className={`rounded-xl border px-3 py-3 text-sm font-black transition ${sort === "popular" ? "border-lime-300/40 bg-lime-300/10 text-lime-300" : "border-white/10 text-gray-400 hover:bg-white/5"}`}>
              인기
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-3 rounded-xl border border-white/10 bg-black/15 p-3 sm:p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold text-gray-500">포함 선수</span>
                <input
                  value={playerQuery}
                  onChange={(event) => setPlayerQuery(event.target.value)}
                  placeholder="예: 비니시우스"
                  className="w-full rounded-xl border border-white/10 bg-[#0f1115] px-3 py-2.5 text-xs text-white outline-none placeholder:text-gray-600 focus:border-lime-400/50"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold text-gray-500">팀컬러 검색</span>
                <input
                  value={teamColorQuery}
                  onChange={(event) => setTeamColorQuery(event.target.value)}
                  placeholder="예: 레알 마드리드"
                  className="w-full rounded-xl border border-white/10 bg-[#0f1115] px-3 py-2.5 text-xs text-white outline-none placeholder:text-gray-600 focus:border-lime-400/50"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold text-gray-500">구단가치</span>
                <select
                  value={valueRange}
                  onChange={(event) => setValueRange(event.target.value as ValueRange)}
                  className="w-full rounded-xl border border-white/10 bg-[#0f1115] px-3 py-2.5 text-xs text-white outline-none focus:border-lime-400/50"
                >
                  <option value="all">전체 구단가치</option>
                  <option value="under50m">5,000만 BP 미만</option>
                  <option value="50m-100m">5,000만 ~ 1억 BP</option>
                  <option value="100m-1b">1억 ~ 10억 BP</option>
                  <option value="1b-3b">10억 ~ 30억 BP</option>
                  <option value="3b-5b">30억 ~ 50억 BP</option>
                  <option value="5b-10b">50억 ~ 100억 BP</option>
                  <option value="over10b">100억 BP 이상</option>
                </select>
              </label>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3">
              <p className="text-[11px] font-bold text-gray-500">
                {loading ? "검색 중..." : `${filtered.length.toLocaleString("ko-KR")}개 스쿼드`}
              </p>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-bold text-gray-400 transition hover:bg-white/5 hover:text-white"
                >
                  조건 초기화
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-[11px] font-bold text-gray-500">
        <span>{loading ? "불러오는 중..." : `${filtered.length.toLocaleString("ko-KR")}개 스쿼드`}</span>
        {activeFilterCount > 0 && !showFilters && (
          <button type="button" onClick={() => setShowFilters(true)} className="text-lime-300">
            필터 {activeFilterCount}개 적용 중
          </button>
        )}
      </div>

      <div className="mt-3 space-y-4">
        {loading && <div className="rounded-2xl border border-white/10 bg-[#171b1f] py-16 text-center text-sm text-gray-500">스쿼드를 불러오는 중...</div>}
        {!loading && error && <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-sm text-red-300">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-[#171b1f] py-16 text-center">
            <p className="font-bold text-gray-300">아직 조건에 맞는 스쿼드가 없습니다.</p>
            {activeFilterCount > 0 ? (
              <button type="button" onClick={resetFilters} className="mt-3 text-sm font-black text-lime-300">검색 조건 초기화 →</button>
            ) : (
              <Link href="/squad" className="mt-3 inline-block text-sm font-black text-lime-300">첫 스쿼드 공유하러 가기 →</Link>
            )}
          </div>
        )}
        {!loading && !error && filtered.map((post) => <SquadFeedCard key={post.id} post={post} />)}
      </div>
    </div>
  );
}
