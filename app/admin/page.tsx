"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Access = "loading" | "logged_out" | "denied" | "allowed";

export default function AdminDashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<Access>("loading");
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function checkAccess() {
      const { data: auth } = await supabase.auth.getUser();
      if (!active) return;
      if (!auth.user) {
        setAccess("logged_out");
        return;
      }

      const { data: admin, error } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", auth.user.id)
        .maybeSingle();

      if (!active) return;
      if (error || !admin) {
        setAccess("denied");
        return;
      }

      setAccess("allowed");
      const { count, error: countError } = await supabase
        .from("content_reports")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");

      if (active && !countError) setPending(count ?? 0);
    }

    void checkAccess();
    return () => { active = false; };
  }, [supabase]);

  if (access === "loading") {
    return <main className="mx-auto max-w-5xl px-6 py-24 text-sm text-gray-400">관리자 권한을 확인하고 있습니다...</main>;
  }

  if (access !== "allowed") {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-center text-white">
        <h1 className="text-2xl font-black">{access === "logged_out" ? "로그인이 필요합니다." : "관리자 전용 페이지"}</h1>
        <p className="mt-3 text-sm text-gray-400">관리자로 등록된 계정만 관리자 페이지에 접근할 수 있습니다.</p>
        <Link href={access === "logged_out" ? "/login" : "/"} className="mt-6 inline-block rounded-xl bg-lime-300 px-5 py-3 text-sm font-bold text-black">
          {access === "logged_out" ? "로그인하기" : "홈으로 돌아가기"}
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f1115] text-white">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-black tracking-[0.16em] text-red-300">ADMIN DASHBOARD</p>
        <h1 className="mt-2 text-3xl font-black">관리자 페이지</h1>
        <p className="mt-3 text-sm text-gray-400">FC Help의 신고 검토 및 운영 작업을 관리합니다.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Link href="/admin/reports" className="group rounded-2xl border border-white/10 bg-[#171b21] p-6 transition hover:border-red-300/40 hover:bg-[#1d222a]">
            <p className="text-xs font-black text-red-300">MODERATION</p>
            <div className="mt-3 flex items-center justify-between gap-4">
              <h2 className="text-xl font-black">신고 관리</h2>
              <span className="text-2xl font-black text-red-200">{pending === null ? "—" : pending}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-gray-400">신고된 게시글·댓글을 검토하고 삭제, 처리 완료, 기각을 관리합니다.</p>
            <p className="mt-4 text-sm font-bold text-lime-300">신고함 열기 →</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
