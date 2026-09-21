"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import SquadFeedCard, { type SquadFeedPost } from "@/components/SquadFeedCard";

type SalaryRange = "all" | "under260" | "261-280" | "281-300" | "301-310";
type ValueRange = "all" | "under1t" | "1-10t" | "10-100t" | "100-1000t" | "1000t-1g" | "1-5g" | "over5g";

const VALUE_1T = BigInt("1000000000000");
const VALUE_10T = BigInt("10000000000000");
const VALUE_100T = BigInt("100000000000000");
const VALUE_1000T = BigInt("1000000000000000");
const VALUE_1G = BigInt("10000000000000000");
const VALUE_5G = BigInt("50000000000000000");

function matchesSalaryRange(salary: number, range: SalaryRange) {
  if (range === "all") return true;
  if (range === "under260") return salary <= 260;
  if (range === "261-280") return salary >= 261 && salary <= 280;
  if (range === "281-300") return salary >= 281 && salary <= 300;
  return salary >= 301 && salary <= 310;
}

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
  if (range === "under1t") return amount < VALUE_1T;
  if (range === "1-10t") return amount >= VALUE_1T && amount < VALUE_10T;
  if (range === "10-100t") return amount >= VALUE_10T && amount < VALUE_100T;
  if (range === "100-1000t") return amount >= VALUE_100T && amount < VALUE_1000T;
  if (range === "1000t-1g") return amount >= VALUE_1000T && amount < VALUE_1G;
  if (range === "1-5g") return amount >= VALUE_1G && amount < VALUE_5G;
  return amount >= VALUE_5G;
}

export default function SquadGallery() {
  const supabase = useMemo(() => createClient(), []);
  const [posts, setPosts] = useState<SquadFeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [playerQuery, setPlayerQuery] = useState("");
  const [teamColor, setTeamColor] = useState("");
  const [salaryRange, setSalaryRange] = useState<SalaryRange>("all");
  const [valueRange, setValueRange] = useState<ValueRange>("all");
  const [sort, setSort] = useState<"latest" | "popular">("latest");

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

  const teamColorOptions = useMemo(
    () => [...new Set(posts.flatMap((post) => post.team_colors ?? []))].sort((a, b) => a.localeCompare(b, "ko")),
    [posts]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const playerNeedle = playerQuery.trim().toLowerCase();

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

      if (teamColor && !(post.team_colors ?? []).includes(teamColor)) {
        return false;
      }

      if (!matchesSalaryRange(Number(post.total_salary) || 0, salaryRange)) {
        return false;
      }

      return matchesValueRange(post.total_value, valueRange);
    });
  }, [playerQuery, posts, query, salaryRange, teamColor, valueRange]);

  const hasAdvancedFilters = Boolean(playerQuery.trim() || teamColor || salaryRange !== "all" || valueRange !== "all");

  function resetFilters() {
    setQuery("");
    setPlayerQuery("");
    setTeamColor("");
    setSalaryRange("all");
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
          <div className="grid grid-cols-2 gap-2 sm:w-56">
            <button type="button" onClick={() => setSort("latest")} className={`rounded-xl border px-3 py-3 text-sm font-black transition ${sort === "latest" ? "border-lime-300/40 bg-lime-300/10 text-lime-300" : "border-white/10 text-gray-400 hover:bg-white/5"}`}>
              최신
            </button>
            <button type="button" onClick={() => setSort("popular")} className={`rounded-xl border px-3 py-3 text-sm font-black transition ${sort === "popular" ? "border-lime-300/40 bg-lime-300/10 text-lime-300" : "border-white/10 text-gray-400 hover:bg-white/5"}`}>
              인기
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
            <span className="mb-1.5 block text-[10px] font-bold text-gray-500">팀컬러</span>
            <select
              value={teamColor}
              onChange={(event) => setTeamColor(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0f1115] px-3 py-2.5 text-xs text-white outline-none focus:border-lime-400/50"
            >
              <option value="">전체 팀컬러</option>
              {teamColorOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-bold text-gray-500">급여</span>
            <select
              value={salaryRange}
              onChange={(event) => setSalaryRange(event.target.value as SalaryRange)}
              className="w-full rounded-xl border border-white/10 bg-[#0f1115] px-3 py-2.5 text-xs text-white outline-none focus:border-lime-400/50"
            >
              <option value="all">전체 급여</option>
              <option value="under260">260 이하</option>
              <option value="261-280">261 ~ 280</option>
              <option value="281-300">281 ~ 300</option>
              <option value="301-310">301 ~ 310</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-bold text-gray-500">구단가치</span>
            <select
              value={valueRange}
              onChange={(event) => setValueRange(event.target.value as ValueRange)}
              className="w-full rounded-xl border border-white/10 bg-[#0f1115] px-3 py-2.5 text-xs text-white outline-none focus:border-lime-400/50"
            >
              <option value="all">전체 구단가치</option>
              <option value="under1t">1조 미만</option>
              <option value="1-10t">1조 ~ 10조</option>
              <option value="10-100t">10조 ~ 100조</option>
              <option value="100-1000t">100조 ~ 1000조</option>
              <option value="1000t-1g">1000조 ~ 1경</option>
              <option value="1-5g">1경 ~ 5경</option>
              <option value="over5g">5경 이상</option>
            </select>
          </label>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-3">
          <p className="text-[11px] font-bold text-gray-500">
            {loading ? "검색 중..." : `${filtered.length.toLocaleString("ko-KR")}개 스쿼드`}
          </p>
          {(hasAdvancedFilters || query.trim()) && (
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

      <div className="mt-5 space-y-4">
        {loading && <div className="rounded-2xl border border-white/10 bg-[#171b1f] py-16 text-center text-sm text-gray-500">스쿼드를 불러오는 중...</div>}
        {!loading && error && <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-sm text-red-300">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-[#171b1f] py-16 text-center">
            <p className="font-bold text-gray-300">아직 조건에 맞는 스쿼드가 없습니다.</p>
            <button type="button" onClick={resetFilters} className="mt-3 text-sm font-black text-lime-300">검색 조건 초기화 →</button>
          </div>
        )}
        {!loading && !error && filtered.map((post) => <SquadFeedCard key={post.id} post={post} />)}
      </div>
    </div>
  );
}
