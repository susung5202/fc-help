"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type ReportTargetType =
  | "community_post"
  | "community_comment"
  | "squad_post"
  | "squad_comment";

const REASONS = [
  ["spam", "스팸/도배"],
  ["abuse", "욕설/괴롭힘"],
  ["inappropriate", "부적절한 콘텐츠"],
  ["misinformation", "허위/오해 소지 정보"],
  ["other", "기타"],
] as const;

type Reason = (typeof REASONS)[number][0];

export default function ReportButton({
  targetType,
  targetId,
  reportedUserId,
  viewerId,
  className = "text-[10px] font-bold text-gray-600 transition hover:text-red-300",
}: {
  targetType: ReportTargetType;
  targetId: string | number;
  reportedUserId?: string | null;
  viewerId: string | null;
  className?: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>("spam");
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);
  const [reported, setReported] = useState(false);
  const [error, setError] = useState("");

  if (viewerId && reportedUserId === viewerId) return null;

  function startReport() {
    if (!viewerId) {
      router.push("/login");
      return;
    }
    setError("");
    setOpen(true);
  }

  async function submitReport() {
    if (!viewerId || saving) return;
    setSaving(true);
    setError("");

    const { error: reportError } = await supabase.from("content_reports").insert({
      reporter_id: viewerId,
      reported_user_id: reportedUserId ?? null,
      target_type: targetType,
      target_id: String(targetId),
      reason,
      details: details.trim().slice(0, 500),
    });

    if (reportError) {
      if (reportError.code === "23505") {
        setReported(true);
        setOpen(false);
      } else {
        setError(reportError.message);
      }
      setSaving(false);
      return;
    }

    setReported(true);
    setSaving(false);
    setOpen(false);
  }

  return (
    <>
      <button type="button" onClick={startReport} disabled={reported} className={className}>
        {reported ? "신고됨" : "신고"}
      </button>

      {open && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-4" onClick={() => !saving && setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#15191d] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black tracking-[0.14em] text-red-300">REPORT</p>
                <h3 className="mt-1 text-lg font-black text-white">신고 사유 선택</h3>
              </div>
              <button type="button" disabled={saving} onClick={() => setOpen(false)} className="h-9 w-9 rounded-full bg-white/5 text-xl text-gray-300">×</button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {REASONS.map(([value, label]) => (
                <button key={value} type="button" onClick={() => setReason(value)} className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${reason === value ? "border-red-300/35 bg-red-400/10 text-red-200" : "border-white/10 text-gray-400"}`}>
                  {label}
                </button>
              ))}
            </div>

            <textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={500} rows={4} placeholder="추가 설명 (선택)" className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-[#0f1115] px-3 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-red-300/30" />
            {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" disabled={saving} onClick={() => setOpen(false)} className="rounded-xl border border-white/10 py-3 text-sm font-bold text-gray-300">취소</button>
              <button type="button" disabled={saving} onClick={() => void submitReport()} className="rounded-xl bg-red-400 py-3 text-sm font-black text-black disabled:opacity-50">
                {saving ? "신고 중..." : "신고하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
