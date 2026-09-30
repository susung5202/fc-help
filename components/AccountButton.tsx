"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import NotificationBell from "@/components/NotificationBell";
import { createClient } from "@/lib/supabase/client";

export default function AccountButton() {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;

    async function syncUser(nextUserId: string | null) {
      if (!active) return;
      setUserId(nextUserId);
      setLoggedIn(Boolean(nextUserId));
      if (!nextUserId) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", nextUserId)
        .maybeSingle();
      if (active) setIsAdmin(Boolean(data));
    }

    void supabase.auth.getSession().then(({ data }) => {
      void syncUser(data.session?.user?.id ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncUser(session?.user?.id ?? null);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  if (loggedIn && userId) {
    return (
      <div className="flex items-center gap-1.5 sm:gap-2">
        <NotificationBell userId={userId} />
        {isAdmin && (
          <Link href="/admin/reports" className="rounded-lg border border-red-300/20 bg-red-400/[0.06] px-2.5 py-2 text-[11px] font-black text-red-200 hover:bg-red-400/10 sm:px-3 sm:text-sm">
            신고관리
          </Link>
        )}
        <Link href="/mypage/activity" className="rounded-lg border border-lime-300/15 bg-lime-300/[0.04] px-2.5 py-2 text-[11px] font-black text-lime-200 hover:bg-lime-300/[0.08] sm:px-3 sm:text-sm">
          내 활동
        </Link>
        <Link href="/mypage/reports" className="hidden rounded-lg border border-white/10 px-2.5 py-2 text-[11px] font-bold text-gray-300 hover:bg-white/5 sm:inline-flex sm:px-3 sm:text-sm">
          신고내역
        </Link>
        <Link href="/mypage" className="rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-black sm:px-4 sm:text-sm">
          마이페이지
        </Link>
      </div>
    );
  }

  return (
    <Link href="/login" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black">
      로그인
    </Link>
  );
}
