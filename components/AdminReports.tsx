"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type ReportStatus = "pending" | "resolved" | "dismissed";
type TargetType = "community_post" | "community_comment" | "squad_post" | "squad_comment";

type ReportRecord = {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  target_type: TargetType;
  target_id: string;
  reason: string;
  details: string;
  status: ReportStatus;
  resolution_note: string;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

type Profile = {
  id: string;
  username: string | null;
  display_name: string;
};

type TargetInfo = {
  exists: boolean;
  label: string;
  preview: string;
  href: string | null;
};

type AccessState = "loading" | "logged_out" | "denied" | "allowed";
type Filter = "all" | ReportStatus;

const REASON_LABEL: Record<string, string> = {
  spam: "스팸/도배",
  abuse: "욕설/괴롭힘",
  inappropriate: "부적절한 콘텐츠",
  misinformation: "허위 정보",
  other: "기타",
};

const TARGET_LABEL: Record<TargetType, string> = {
  community_post: "커뮤니티 글",
  community_comment: "커뮤니티 댓글",
  squad_post: "스쿼드 게시글",
  squad_comment: "스쿼드 댓글",
};

const STATUS_LABEL: Record<ReportStatus, string> = {
  pending: "대기",
  resolved: "처리완료",
  dismissed: "기각",
};

function targetKey(type: TargetType, id: string) {
  return `${type}:${id}`;
}

function shortText(value: string | null | undefined, max = 110) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export default function AdminReports() {
  const supabase = useMemo(() => createClient(), []);
  const [access, setAccess] = useState<AccessState>("loading");
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [targets, setTargets] = useState<Record<string, TargetInfo>>({});
  const [filter, setFilter] = useState<Filter>("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setMessage("");
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!active) return;
      if (!user) {
        setAccess("logged_out");
        return;
      }

      setViewerId(user.id);
      const { data: adminRow, error: adminError } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active) return;
      if (adminError || !adminRow) {
        setAccess("denied");
        return;
      }

      setAccess("allowed");
      const { data: reportRows, error: reportError } = await supabase
        .from("content_reports")
        .select("id,reporter_id,reported_user_id,target_type,target_id,reason,details,status,resolution_note,created_at,resolved_at,resolved_by")
        .order("created_at", { ascending: false })
        .limit(200);

      if (!active) return;
      if (reportError) {
        setMessage(reportError.message);
        return;
      }

      const loadedReports = (reportRows ?? []) as ReportRecord[];
      setReports(loadedReports);
      setNotes(Object.fromEntries(loadedReports.map((report) => [report.id, report.resolution_note || ""])));

      const userIds = Array.from(new Set(loadedReports.flatMap((report) => [report.reporter_id, report.reported_user_id, report.resolved_by].filter(Boolean) as string[])));
      if (userIds.length > 0) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id,username,display_name")
          .in("id", userIds);
        if (active) setProfiles(Object.fromEntries(((profileRows ?? []) as Profile[]).map((profile) => [profile.id, profile])));
      }

      const nextTargets: Record<string, TargetInfo> = {};
      const communityPostIds = loadedReports.filter((report) => report.target_type === "community_post").map((report) => report.target_id);
      const communityCommentIds = loadedReports.filter((report) => report.target_type === "community_comment").map((report) => Number(report.target_id)).filter(Number.isFinite);
      const squadPostIds = loadedReports.filter((report) => report.target_type === "squad_post").map((report) => report.target_id);
      const squadCommentIds = loadedReports.filter((report) => report.target_type === "squad_comment").map((report) => Number(report.target_id)).filter(Number.isFinite);

      const [communityPosts, communityComments, squadPosts, squadComments] = await Promise.all([
        communityPostIds.length > 0 ? supabase.from("community_posts").select("id,title,content").in("id", communityPostIds) : Promise.resolve({ data: [] }),
        communityCommentIds.length > 0 ? supabase.from("community_comments").select("id,post_id,content").in("id", communityCommentIds) : Promise.resolve({ data: [] }),
        squadPostIds.length > 0 ? supabase.from("squad_posts").select("id,title,description").in("id", squadPostIds) : Promise.resolve({ data: [] }),
        squadCommentIds.length > 0 ? supabase.from("squad_comments").select("id,post_id,content").in("id", squadCommentIds) : Promise.resolve({ data: [] }),
      ]);

      for (const row of (communityPosts.data ?? []) as { id: string; title: string; content: string }[]) {
        nextTargets[targetKey("community_post", row.id)] = { exists: true, label: row.title, preview: shortText(row.content), href: `/community/${row.id}` };
      }
      for (const row of (communityComments.data ?? []) as { id: number; post_id: string; content: string }[]) {
        nextTargets[targetKey("community_comment", String(row.id))] = { exists: true, label: `커뮤니티 댓글 #${row.id}`, preview: shortText(row.content), href: `/community/${row.post_id}` };
      }
      for (const row of (squadPosts.data ?? []) as { id: string; title: string; description: string | null }[]) {
        nextTargets[targetKey("squad_post", row.id)] = { exists: true, label: row.title, preview: shortText(row.description), href: `/squad/gallery/${row.id}` };
      }
      for (const row of (squadComments.data ?? []) as { id: number; post_id: string; content: string }[]) {
        nextTargets[targetKey("squad_comment", String(row.id))] = { exists: true, label: `스쿼드 댓글 #${row.id}`, preview: shortText(row.content), href: `/squad/gallery/${row.post_id}` };
      }

      for (const report of loadedReports) {
        const key = targetKey(report.target_type, report.target_id);
        if (!nextTargets[key]) {
          nextTargets[key] = { exists: false, label: `${TARGET_LABEL[report.target_type]} · 삭제됨`, preview: "현재 원문을 찾을 수 없습니다.", href: null };
        }
      }

      if (active) setTargets(nextTargets);
    }

    void load();
    return () => { active = false; };
  }, [supabase]);

  async function updateStatus(report: ReportRecord, status: ReportStatus, fallbackNote: string) {
    if (!viewerId || busyId) return;
    setBusyId(report.id);
    setMessage("");
    const note = (notes[report.id] || fallbackNote).trim().slice(0, 500);
    const resolved = status !== "pending";
    const payload = {
      status,
      resolution_note: resolved ? note : "",
      resolved_at: resolved ? new Date().toISOString() : null,
      resolved_by: resolved ? viewerId : null,
    };
    const { data: updatedRow, error } = await supabase
      .from("content_reports")
      .update(payload)
      .eq("id", report.id)
      .select("id")
      .maybeSingle();
    if (error || !updatedRow) {
      setMessage(error?.message || "신고 상태를 변경하지 못했습니다. 목록을 새로고침해주세요.");
      setBusyId(null);
      return;
    }
    setReports((current) => current.map((item) => item.id === report.id ? { ...item, ...payload } as ReportRecord : item));
    setNotes((current) => ({ ...current, [report.id]: payload.resolution_note }));
    setBusyId(null);
  }

  async function deleteTarget(report: ReportRecord) {
    if (!viewerId || busyId) return;
    const target = targets[targetKey(report.target_type, report.target_id)];
    if (!target?.exists) return;
    if (!window.confirm(`신고 대상 ${TARGET_LABEL[report.target_type]}을(를) 삭제할까요? 삭제와 신고 처리가 동시에 완료되며 되돌릴 수 없습니다.`)) return;

    setBusyId(report.id);
    setMessage("");

    const resolutionNote =
      (notes[report.id] || "신고 대상 콘텐츠 삭제").trim().slice(0, 500) ||
      "신고 대상 콘텐츠 삭제";

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setMessage("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
        setBusyId(null);
        return;
      }

      const response = await fetch("/api/admin/reports/delete-target", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          reportId: report.id,
          resolutionNote,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        status?: ReportStatus;
        resolvedAt?: string;
        resolvedBy?: string;
        resolutionNote?: string;
      };

      if (!response.ok || payload.status !== "resolved" || !payload.resolvedAt) {
        setMessage(payload.error || "콘텐츠 삭제 처리에 실패했습니다.");
        setBusyId(null);
        return;
      }

      setTargets((current) => ({
        ...current,
        [targetKey(report.target_type, report.target_id)]: {
          exists: false,
          label: `${TARGET_LABEL[report.target_type]} · 삭제됨`,
          preview: "관리자가 신고 대상 콘텐츠를 삭제했습니다.",
          href: null,
        },
      }));

      setReports((current) =>
        current.map((item) =>
          item.id === report.id
            ? {
                ...item,
                status: "resolved",
                resolution_note: payload.resolutionNote || resolutionNote,
                resolved_at: payload.resolvedAt || null,
                resolved_by: payload.resolvedBy || viewerId,
              }
            : item
        )
      );
      setNotes((current) => ({
        ...current,
        [report.id]: payload.resolutionNote || resolutionNote,
      }));
      setMessage("신고 대상 콘텐츠를 삭제하고 신고를 처리 완료했습니다.");
    } catch {
      setMessage("콘텐츠 삭제 처리 중 오류가 발생했습니다.");
    } finally {
      setBusyId(null);
    }
  }

  if (access === "loading") {
    return <main className="mx-auto w-full max-w-6xl px-4 py-20 text-center text-sm text-gray-500">관리자 권한을 확인하는 중...</main>;
  }

  if (access === "logged_out") {
    return <main className="mx-auto w-full max-w-xl px-4 py-20 text-center"><h1 className="text-2xl font-black">관리자 로그인 필요</h1><p className="mt-2 text-sm text-gray-500">신고 관리 페이지는 관리자 계정만 접근할 수 있습니다.</p><Link href="/login" className="mt-5 inline-block rounded-xl bg-lime-300 px-5 py-3 text-sm font-black text-black">로그인</Link></main>;
  }

  if (access === "denied") {
    return <main className="mx-auto w-full max-w-xl px-4 py-20 text-center"><p className="text-xs font-black tracking-[0.16em] text-red-300">ADMIN ONLY</p><h1 className="mt-2 text-2xl font-black">관리자 권한이 없습니다.</h1><p className="mt-2 text-sm text-gray-500">관리자로 등록된 계정만 신고함을 볼 수 있습니다.</p><Link href="/" className="mt-5 inline-block text-sm font-black text-lime-300">홈으로 돌아가기 →</Link></main>;
  }

  const filtered = reports.filter((report) => filter === "all" || report.status === filter);
  const pendingCount = reports.filter((report) => report.status === "pending").length;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-red-300">ADMIN · MODERATION</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">신고 관리</h1>
          <p className="mt-2 text-sm text-gray-500">대기 중인 신고를 확인하고 콘텐츠를 처리합니다.</p>
        </div>
        <div className="rounded-xl border border-red-300/15 bg-red-400/[0.05] px-4 py-2 text-sm font-black text-red-200">대기 {pendingCount}건</div>
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {(["pending", "all", "resolved", "dismissed"] as Filter[]).map((value) => (
          <button key={value} type="button" onClick={() => setFilter(value)} className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-black transition ${filter === value ? "border-lime-300/35 bg-lime-300/[0.08] text-lime-300" : "border-white/10 text-gray-500 hover:text-white"}`}>
            {value === "all" ? `전체 ${reports.length}` : `${STATUS_LABEL[value]} ${reports.filter((report) => report.status === value).length}`}
          </button>
        ))}
      </div>

      {message && <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] px-4 py-3 text-xs text-amber-100">{message}</div>}

      <div className="mt-5 space-y-3">
        {filtered.length === 0 && <div className="rounded-2xl border border-white/10 bg-[#15191d] py-16 text-center text-sm text-gray-600">해당 신고가 없습니다.</div>}
        {filtered.map((report) => {
          const reporter = profiles[report.reporter_id];
          const reported = report.reported_user_id ? profiles[report.reported_user_id] : null;
          const target = targets[targetKey(report.target_type, report.target_id)];
          const busy = busyId === report.id;
          return (
            <article key={report.id} className="rounded-2xl border border-white/10 bg-[#15191d] p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md border px-2 py-1 text-[10px] font-black ${report.status === "pending" ? "border-amber-300/20 bg-amber-300/[0.06] text-amber-200" : report.status === "resolved" ? "border-lime-300/20 bg-lime-300/[0.06] text-lime-200" : "border-white/10 bg-white/[0.04] text-gray-400"}`}>{STATUS_LABEL[report.status]}</span>
                    <span className="rounded-md border border-red-300/15 bg-red-400/[0.05] px-2 py-1 text-[10px] font-black text-red-200">{REASON_LABEL[report.reason] || report.reason}</span>
                    <span className="text-[10px] font-bold text-gray-600">{TARGET_LABEL[report.target_type]}</span>
                  </div>
                  <h2 className="mt-2 truncate text-base font-black text-white">{target?.label || TARGET_LABEL[report.target_type]}</h2>
                  <p className="mt-1 text-xs leading-5 text-gray-500">{target?.preview || "대상 정보를 불러오는 중..."}</p>
                </div>
                <span className="shrink-0 text-[10px] text-gray-600">{new Date(report.created_at).toLocaleString("ko-KR")}</span>
              </div>

              <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                <div className="rounded-xl bg-black/15 px-3 py-2.5"><span className="text-gray-600">신고자 </span><span className="font-bold text-gray-300">{reporter?.display_name || "사용자"}{reporter?.username ? ` @${reporter.username}` : ""}</span></div>
                <div className="rounded-xl bg-black/15 px-3 py-2.5"><span className="text-gray-600">신고 대상 사용자 </span><span className="font-bold text-gray-300">{reported?.display_name || (report.reported_user_id ? "사용자" : "- ")}{reported?.username ? ` @${reported.username}` : ""}</span></div>
              </div>

              {report.details && <div className="mt-3 rounded-xl border border-white/[0.07] bg-black/10 px-3 py-3 text-xs leading-5 text-gray-400"><span className="font-black text-gray-300">신고 내용 · </span>{report.details}</div>}

              <textarea value={notes[report.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [report.id]: event.target.value }))} maxLength={500} rows={2} placeholder="관리자 처리 메모" className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-[#0f1115] px-3 py-2.5 text-xs text-white outline-none placeholder:text-gray-700 focus:border-lime-300/30" />

              <div className="mt-3 flex flex-wrap gap-2">
                {target?.href && <Link href={target.href} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-300 hover:bg-white/5">원문 보기</Link>}
                {target?.exists && <button type="button" disabled={busy} onClick={() => void deleteTarget(report)} className="rounded-lg border border-red-400/20 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-400/5 disabled:opacity-50">콘텐츠 삭제</button>}
                {report.status !== "resolved" && <button type="button" disabled={busy} onClick={() => void updateStatus(report, "resolved", "관리자 처리 완료")} className="rounded-lg bg-lime-300 px-3 py-2 text-xs font-black text-black disabled:opacity-50">처리완료</button>}
                {report.status !== "dismissed" && <button type="button" disabled={busy} onClick={() => void updateStatus(report, "dismissed", "신고 기각")} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-400 hover:text-white disabled:opacity-50">기각</button>}
                {report.status !== "pending" && <button type="button" disabled={busy} onClick={() => void updateStatus(report, "pending", "")} className="rounded-lg border border-amber-300/15 px-3 py-2 text-xs font-bold text-amber-200/80 disabled:opacity-50">대기로 되돌리기</button>}
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
