"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function AccountButton() {
  const supabase = useMemo(() => createClient(), []);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active) setLoggedIn(Boolean(data.session?.user));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setLoggedIn(Boolean(session?.user));
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <Link
      href={loggedIn ? "/mypage" : "/login"}
      className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black"
    >
      {loggedIn ? "마이페이지" : "로그인"}
    </Link>
  );
}
