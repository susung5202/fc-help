"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function NotificationBell({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [unread, setUnread] = useState(0);

  const loadUnread = useCallback(async () => {
    const { count, error } = await supabase
      .from("user_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);

    if (!error) setUnread(count ?? 0);
  }, [supabase, userId]);

  useEffect(() => {
    void loadUnread();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadUnread();
    }, 30000);

    const onFocus = () => void loadUnread();
    const onChanged = () => void loadUnread();
    window.addEventListener("focus", onFocus);
    window.addEventListener("fc-help-notifications-changed", onChanged);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("fc-help-notifications-changed", onChanged);
    };
  }, [loadUnread]);

  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? `알림 ${unread}개` : "알림"}
      title="알림"
      className="relative flex h-9 w-9 shrink-0 items-center justify-center border border-[#263750] bg-[#0a1627] text-base text-[#9aabc3] transition hover:border-[#3f75ff] hover:text-white"
    >
      <span aria-hidden>🔔</span>
      {unread > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex min-w-5 items-center justify-center bg-[#ff5d73] px-1.5 py-0.5 text-[10px] font-black leading-none text-white shadow-lg">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
