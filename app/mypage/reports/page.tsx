"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MyPageNav from "@/components/MyPageNav";
import { createClient } from "@/lib/supabase/client";

type Report = {
  id: string;
  target_type: "community_post" | "community_comment" | "squad_post" | "squad_comment";
  target_id: string;
  reason: "spam" | "abuse" | "inappropriate" | "misinformation" | "other";
  details: string;
  status: "pending" | "resolved" | "dismissed";
  resolution_note: string;
  created_at: string;
  resolved_at: string | null;
};

const STATUS_LABEL: Record<Report["status"], string> = {
  pending: "검토 대기",
  resolved: "처리 완료",
  dismissed: "기각",
};

const STATUS_TONE: Record<Report["status"], string> = {
  pending: "border-amber-300/20 bg-amber-300/5 text-amber-200",
  resolved: "border-lime-300/20 bg-lime-300/5 text-lime-200",
  dismissed: "border-white/10 bg-white/[0.03] text-gray-400",
};

const REASON_LABEL: Record<Report["reason"], string> = {
  spam: "스팸/도배",
  abuse: "욕설/괴롭힘",
  inappropriate: "부적절한 콘텐츠",
  misinformation: "허위 정보",
  other: "기타",
};

const TARGET_LABEL: Record<Report["target_type"], string> = {
  community_post: "커뮤니티 게시글",
  community_comment: "커뮤니티 댓글",
  squad_post: "스쿼드 게시글",
  squad_comment: "스쿼드 댓글",
};

export default function MyReportsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [reports, setReports] = useState<Report[]>([]);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setMessage("");
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("content_reports")
        .select("id,target_type,target_id,reason,details,status,resolution_note,created_at,resolved_at")
        .eq("reporter_id", user.id)
        .order("created_at", { ascending: false });

      if (!active) return;
      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as Report[];
      setReports(rows);

      const nextLinks: Record<string, string> = {};
      const communityCommentIds = rows.filter((row) => row.target_type === "community_comment").map((row) => Number(row.target_id)).filter(Number.isFinite);
      const squadCommentIds = rows.filter((row) => row.target_type === "squad_comment").map((row) => Number(row.target_id)).filter(Number.isFinite);

      rows.forEach((row) => {
        if (row.target_type === "community_post") nextLinks[row.id] = `/community/${row.target_id}`;
        if (row.target_type === "squad_post") nextLinks[row.id] = `/squad/gallery/${row.target_id}`;
      });

      const [communityComments, squadComments] = await Promise.all([
        communityCommentIds.length > 0
          ? supabase.from("community_comments").select("id,post_id").in("id", communityCommentIds)
          : Promise.resolve({ data: [] as Array<{ id: number; post_id: string }> }),
        squadCommentIds.length > 0
          ? supabase.from("squad_comments").select("id,post_id").in("id", squadCommentIds)
          : Promise.resolve({ data: [] as Array<{ id: number; post_id: string }> }),
      ]);

      const communityPostByComment = new Map((communityComments.data ?? []).map((row) => [String(row.id), row.post_id]));
      const squadPostByComment = new Map((squadComments.data ?? []).map((row) => [String(row.id), row.post_id]));

      rows.forEach((row) => {
        if (row.target_type === "community_comment") {
          const postId = communityPostByComment.get(row.target_id);
          if (postId) nextLinks[row.id] = `/community/${postId}`;
        }
        if (row.target_type === "squad_comment") {
          const postId = squadPostByComment.get(row.target_id);
          if (postId) nextLinks[row.id] = `/squad/gallery/${postId}`;
        }
      });

      if (active) {
        setLinks(nextLinks);
        setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [router, supabase]);

  return (
    <main className="min-h-screen bg-[#0f1115] text-white">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black tracking-[0.16em] text-lime-400">MY REPORTS</p>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl">내 신고내역</h1>
            <p className="mt-2 text-sm text-gray-500">내가 접수한 신고와 처리 상태를 확인할 수 있습니다.</p>
          </div>
        </div>

        <div className="mt-6">
          <MyPageNav />
        </div>

        {message && <p className="mt-5 rounded-xl border border-amber-300/15 bg-amber-300/5 px-4 py-3 text-sm text-amber-200">{message}</p>}

        {loading ? (
          <p className="py-20 text-center text-sm text-gray-600">신고내역을 불러오는 중...</p>
        ) : reports.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-[#15191d] py-20 text-center">
            <p className="font-black text-gray-300">접수한 신고가 없습니다.</p>
            <p className="mt-2 text-xs text-gray-600">신고를 접수하면 처리 상태가 여기에 표시됩니다.</p>
          </div>
        ) : (
          <div className="mt-7 space-y-3">
            {reports.map((report) => (
              <article key={report.id} className="rounded-2xl border border-white/10 bg-[#15191d] p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-lg border px-2.5 py-1 text-[10px] font-black ${STATUS_TONE[report.status]}`}>{STATUS_LABEL[report.status]}</span>
                      <span className="text-xs font-black text-gray-200">{TARGET_LABEL[report.target_type]}</span>
                    </div>
                    <p className="mt-2 text-sm font-black text-white">{REASON_LABEL[report.reason]}</p>
                    <p className="mt-1 text-[11px] text-gray-600">{new Date(report.created_at).toLocaleString("ko-KR")}</p>
                  </div>
                  {links[report.id] ? (
                    <Link href={links[report.id]} className="rounded-lg border border-white/10 px-3 py-2 text-[11px] font-bold text-gray-300 hover:bg-white/5">신고한 콘텐츠 보기 →</Link>
                  ) : (
                    <span className="text-[11px] text-gray-700">삭제되었거나 찾을 수 없는 콘텐츠</span>
                  )}
                </div>

                {report.details && <p className="mt-4 whitespace-pre-wrap rounded-xl bg-black/20 px-3 py-2.5 text-sm leading-6 text-gray-300">{report.details}</p>}

                {report.status !== "pending" && (
                  <div className="mt-4 border-t border-white/[0.07] pt-4">
                    <p className="text-[10px] font-black text-gray-600">처리 결과</p>
                    <p className="mt-1 text-sm text-gray-300">{report.resolution_note || (report.status === "resolved" ? "신고 내용을 확인하고 처리했습니다." : "신고 대상에 대한 조치가 필요하지 않은 것으로 판단되었습니다.")}</p>
                    {report.resolved_at && <p className="mt-1 text-[10px] text-gray-700">{new Date(report.resolved_at).toLocaleString("ko-KR")}</p>}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
