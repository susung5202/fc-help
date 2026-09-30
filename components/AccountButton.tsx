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
          <Link href="/admin/reports" className="border border-red-300/20 bg-red-400/[0.05] px-2.5 py-2 text-[11px] font-black text-red-200 hover:bg-red-400/10 sm:px-3 sm:text-sm">
            신고관리
          </Link>
        )}
        <Link href="/mypage/activity" className="border border-[#2c4670] bg-[#0c1c32] px-2.5 py-2 text-[11px] font-black text-[#8daeff] hover:border-[#3f75ff] hover:text-white sm:px-3 sm:text-sm">
          내 활동
        </Link>
        <Link href="/mypage/reports" className="hidden border border-[#263750] px-2.5 py-2 text-[11px] font-bold text-[#8292aa] hover:border-[#3b5277] hover:text-white sm:inline-flex sm:px-3 sm:text-sm">
          신고내역
        </Link>
        <Link href="/mypage" className="border border-[#3f75ff] bg-[#3f75ff] px-3 py-2 text-[11px] font-black text-white hover:bg-[#5b88ff] sm:px-4 sm:text-sm">
          마이페이지
        </Link>
      </div>
    );
  }

  return (
    <Link href="/login" className="border border-[#3f75ff] bg-[#3f75ff] px-4 py-2 text-sm font-black text-white transition hover:bg-[#5b88ff]">
      로그인
    </Link>
  );
}
