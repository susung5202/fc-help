"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type NotificationRow = {
  id: number;
  type:
    | "community_comment"
    | "community_reply"
    | "community_like"
    | "squad_comment"
    | "squad_reply"
    | "squad_like"
    | "squad_comment_like"
    | "report_resolved"
    | "report_dismissed";
  title: string;
  body: string;
  href: string;
  read_at: string | null;
  created_at: string;
};

function iconFor(type: NotificationRow["type"]) {
  if (type === "community_comment" || type === "community_reply" || type === "squad_comment" || type === "squad_reply") return "💬";
  if (type === "community_like" || type === "squad_like" || type === "squad_comment_like") return "♥";
  if (type === "report_resolved") return "✓";
  if (type === "report_dismissed") return "!";
  return "🔔";
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "방금 전";
  if (diff < hour) return `${Math.floor(diff / minute)}분 전`;
  if (diff < day) return `${Math.floor(diff / hour)}시간 전`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}일 전`;
  return date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function NotificationsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState("");
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      const { data, error: authError } = await supabase.auth.getUser();
      const user = data.user;
      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: rows, error: listError } = await supabase
        .from("user_notifications")
        .select("id,type,title,body,href,read_at,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (!active) return;
      setUserId(user.id);
      if (listError) setError("알림을 불러오지 못했습니다.");
      setNotifications((rows ?? []) as NotificationRow[]);
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  const unreadCount = notifications.filter((item) => !item.read_at).length;

  async function markAllRead() {
    if (!userId || unreadCount === 0 || busy) return;
    setBusy(true);
    setError("");
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("user_notifications")
      .update({ read_at: now })
      .eq("user_id", userId)
      .is("read_at", null);

    if (updateError) {
      setError("알림 읽음 처리에 실패했습니다.");
      setBusy(false);
      return;
    }

    setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? now })));
    window.dispatchEvent(new Event("fc-help-notifications-changed"));
    setBusy(false);
  }

  async function openNotification(item: NotificationRow) {
    if (!item.read_at) {
      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("user_notifications")
        .update({ read_at: now })
        .eq("id", item.id)
        .eq("user_id", userId);

      if (!updateError) {
        setNotifications((current) =>
          current.map((row) => (row.id === item.id ? { ...row, read_at: now } : row))
        );
        window.dispatchEvent(new Event("fc-help-notifications-changed"));
      }
    }

    router.push(item.href || "/notifications");
  }

  if (loading) {
    return <main className="min-h-screen bg-[#0f1115] px-4 py-20 text-center text-sm text-gray-500">알림을 불러오는 중...</main>;
  }

  return (
    <main className="min-h-screen bg-[#0f1115] text-white">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black tracking-[0.18em] text-lime-400">NOTIFICATIONS</p>
            <h1 className="mt-1 text-3xl font-black">알림</h1>
            <p className="mt-2 text-sm text-gray-500">댓글, 대댓글, 좋아요, 신고 처리 결과를 확인합니다.</p>
          </div>
          <Link href="/" className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-black text-gray-300 hover:bg-white/5">
            ← 홈
          </Link>
        </div>

        <div className="mt-6 flex items-center justify-between rounded-2xl border border-white/10 bg-[#171b1f] px-4 py-3">
          <p className="text-sm text-gray-400">
            안 읽은 알림 <span className="font-black text-lime-300">{unreadCount}</span>개
          </p>
          <button
            type="button"
            onClick={() => void markAllRead()}
            disabled={unreadCount === 0 || busy}
            className="rounded-lg bg-white px-3 py-2 text-xs font-black text-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "처리 중..." : "모두 읽음"}
          </button>
        </div>

        {error && <p className="mt-4 rounded-xl border border-red-300/20 bg-red-400/5 px-4 py-3 text-sm text-red-200">{error}</p>}

        <div className="mt-4 space-y-2">
          {notifications.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#171b1f] px-6 py-16 text-center">
              <p className="text-3xl">🔔</p>
              <p className="mt-3 font-black">아직 알림이 없습니다.</p>
              <p className="mt-1 text-sm text-gray-600">새 활동이 생기면 여기에 표시됩니다.</p>
            </div>
          ) : (
            notifications.map((item) => {
              const unread = !item.read_at;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void openNotification(item)}
                  className={`flex w-full gap-4 rounded-2xl border p-4 text-left transition hover:bg-white/[0.04] sm:p-5 ${
                    unread
                      ? "border-lime-300/20 bg-lime-300/[0.035]"
                      : "border-white/10 bg-[#171b1f]"
                  }`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${unread ? "bg-lime-300/10 text-lime-300" : "bg-white/5 text-gray-400"}`}>
                    {iconFor(item.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className={`text-sm font-black ${unread ? "text-white" : "text-gray-300"}`}>{item.title}</p>
                      {unread && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-lime-300" />}
                    </div>
                    {item.body && <p className="mt-1 line-clamp-2 text-sm leading-5 text-gray-500">{item.body}</p>}
                    <p className="mt-2 text-[11px] text-gray-600">{formatWhen(item.created_at)}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
