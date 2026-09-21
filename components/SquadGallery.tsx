"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import SquadFeedCard, { type SquadFeedPost } from "@/components/SquadFeedCard";

export default function SquadGallery() {
  const supabase = useMemo(() => createClient(), []);
  const [posts, setPosts] = useState<SquadFeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
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
        .limit(60);

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

  const filtered = posts.filter((post) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return [
      post.title,
      post.description,
      post.author_name,
      post.formation,
      ...(post.player_names ?? []),
      ...(post.team_colors ?? []),
    ].some((value) => String(value ?? "").toLowerCase().includes(needle));
  });

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
            placeholder="선수, 팀컬러, 제목, 작성자 검색"
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
      </div>

      <div className="mt-5 space-y-4">
        {loading && <div className="rounded-2xl border border-white/10 bg-[#171b1f] py-16 text-center text-sm text-gray-500">스쿼드를 불러오는 중...</div>}
        {!loading && error && <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-5 text-sm text-red-300">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-[#171b1f] py-16 text-center">
            <p className="font-bold text-gray-300">아직 조건에 맞는 스쿼드가 없습니다.</p>
            <Link href="/squad" className="mt-3 inline-block text-sm font-black text-lime-300">첫 스쿼드 공유하러 가기 →</Link>
          </div>
        )}
        {!loading && !error && filtered.map((post) => <SquadFeedCard key={post.id} post={post} />)}
      </div>
    </div>
  );
}
