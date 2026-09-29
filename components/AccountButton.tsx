"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AccountButton() {
  const supabase = useMemo(() => createClient(), []);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;

    async function syncUser(userId: string | null) {
      if (!active) return;
      setLoggedIn(Boolean(userId));
      if (!userId) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", userId)
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

  if (loggedIn && isAdmin) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/admin/reports" className="rounded-lg border border-red-300/20 bg-red-400/[0.06] px-3 py-2 text-xs font-black text-red-200 hover:bg-red-400/10 sm:text-sm">
          신고관리
        </Link>
        <Link href="/mypage" className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black">
          마이페이지
        </Link>
      </div>
    );
  }

  return (
    <Link
      href={loggedIn ? "/mypage" : "/login"}
      className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black"
    >
      {loggedIn ? "마이페이지" : "로그인"}
    </Link>
  );
}
