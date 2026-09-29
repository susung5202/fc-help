"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReportButton from "@/components/ReportButton";
import { createClient } from "@/lib/supabase/client";

export type ThreadedCommentData = {
  id: number;
  post_id: string;
  user_id: string;
  parent_id: number | null;
  content: string;
  created_at: string;
  updated_at?: string | null;
  author_name?: string;
  likes_count?: number;
};

export type ThreadedCommentProfile = {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
};

type Kind = "community" | "squad";

export default function ThreadedComments({
  kind,
  postId,
  initialComments,
  initialProfiles,
  viewerId,
  maxLength,
  placeholder,
  onCountChange,
}: {
  kind: Kind;
  postId: string;
  initialComments: ThreadedCommentData[];
  initialProfiles: Record<string, ThreadedCommentProfile>;
  viewerId: string | null;
  maxLength: number;
  placeholder: string;
  onCountChange?: (count: number) => void;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [comments, setComments] = useState(initialComments);
  const [profiles, setProfiles] = useState(initialProfiles);
  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  useEffect(() => {
    setProfiles(initialProfiles);
  }, [initialProfiles]);

  useEffect(() => {
    onCountChange?.(comments.length);
  }, [comments.length, onCountChange]);

  const table = kind === "community" ? "community_comments" : "squad_comments";
  const reportType = kind === "community" ? "community_comment" : "squad_comment";
  const topLevel = comments.filter((comment) => comment.parent_id == null);

  async function ensureViewerProfile() {
    if (!viewerId) return null;
    if (profiles[viewerId]) return profiles[viewerId];
    const { data } = await supabase
      .from("profiles")
      .select("id,username,display_name,avatar_url")
      .eq("id", viewerId)
      .maybeSingle();
    if (!data) return null;
    const profile = data as ThreadedCommentProfile;
    setProfiles((current) => ({ ...current, [profile.id]: profile }));
    return profile;
  }

  async function addComment(parentId: number | null, rawText: string) {
    if (!viewerId) {
      router.push("/login");
      return false;
    }
    const text = rawText.trim().slice(0, maxLength);
    if (!text || busy) return false;

    setBusy(true);
    setMessage("");
    const viewerProfile = await ensureViewerProfile();
    let authorName = viewerProfile?.display_name || "구단주";

    if (kind === "squad" && !viewerProfile) {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      authorName = String(user?.user_metadata?.display_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "구단주").slice(0, 40);
    }

    const payload = kind === "squad"
      ? { post_id: postId, user_id: viewerId, author_name: authorName.slice(0, 40), parent_id: parentId, content: text }
      : { post_id: postId, user_id: viewerId, parent_id: parentId, content: text };
    const selectColumns = kind === "squad"
      ? "id,post_id,user_id,author_name,parent_id,content,likes_count,created_at,updated_at"
      : "id,post_id,user_id,parent_id,content,created_at,updated_at";

    const { data, error } = await supabase.from(table).insert(payload).select(selectColumns).single();
    if (error || !data) {
      setMessage(error?.message || "댓글을 등록하지 못했습니다.");
      setBusy(false);
      return false;
    }

    setComments((current) => [...current, data as ThreadedCommentData]);
    setBusy(false);
    return true;
  }

  async function submitTopLevel() {
    const ok = await addComment(null, content);
    if (ok) setContent("");
  }

  async function submitReply(parentId: number) {
    const ok = await addComment(parentId, replyText);
    if (ok) {
      setReplyText("");
      setReplyTo(null);
    }
  }

  function beginEdit(comment: ThreadedCommentData) {
    setEditId(comment.id);
    setEditText(comment.content);
    setReplyTo(null);
    setMessage("");
  }

  async function saveEdit(commentId: number) {
    if (!viewerId || busy) return;
    const text = editText.trim().slice(0, maxLength);
    if (!text) return;
    setBusy(true);
    setMessage("");
    const updatedAt = new Date().toISOString();
    const { error } = await supabase
      .from(table)
      .update({ content: text, updated_at: updatedAt })
      .eq("id", commentId)
      .eq("user_id", viewerId);
    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }
    setComments((current) => current.map((comment) => comment.id === commentId ? { ...comment, content: text, updated_at: updatedAt } : comment));
    setEditId(null);
    setEditText("");
    setBusy(false);
  }

  async function deleteComment(comment: ThreadedCommentData) {
    if (!viewerId || comment.user_id !== viewerId || busy) return;
    const replyCount = comments.filter((item) => item.parent_id === comment.id).length;
    const prompt = replyCount > 0
      ? `이 댓글을 삭제하면 답글 ${replyCount}개도 함께 삭제됩니다. 삭제할까요?`
      : "댓글을 삭제할까요?";
    if (!window.confirm(prompt)) return;

    setBusy(true);
    const { error } = await supabase.from(table).delete().eq("id", comment.id).eq("user_id", viewerId);
    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }
    setComments((current) => current.filter((item) => item.id !== comment.id && item.parent_id !== comment.id));
    if (replyTo === comment.id) setReplyTo(null);
    if (editId === comment.id) setEditId(null);
    setBusy(false);
  }

  function renderComment(comment: ThreadedCommentData, isReply: boolean) {
    const profile = profiles[comment.user_id];
    const displayName = profile?.display_name || comment.author_name || "구단주";
    const initial = displayName.trim().slice(0, 1).toUpperCase();
    const replies = isReply ? [] : comments.filter((item) => item.parent_id === comment.id);
    const wasEdited = Boolean(comment.updated_at && new Date(comment.updated_at).getTime() - new Date(comment.created_at).getTime() > 1000);
    const own = viewerId === comment.user_id;

    return (
      <div key={comment.id} className={isReply ? "ml-7 border-l border-white/10 pl-3 sm:ml-10 sm:pl-4" : ""}>
        <div className="rounded-xl border border-white/[0.08] bg-black/10 p-3.5">
          <div className="flex items-start justify-between gap-3">
            <Link href={`/profile/${profile?.username || comment.user_id}`} className="inline-flex min-w-0 items-center gap-2 transition hover:text-lime-300">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#242a27] text-[10px] font-black text-lime-200">
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : initial}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-black text-gray-200">{displayName}</span>
                {profile?.username && <span className="block truncate text-[10px] text-gray-600">@{profile.username}</span>}
              </span>
            </Link>
            <div className="shrink-0 text-right">
              <span className="block text-[10px] text-gray-600">{new Date(comment.created_at).toLocaleString("ko-KR")}</span>
              {wasEdited && <span className="mt-0.5 block text-[9px] text-gray-700">수정됨</span>}
            </div>
          </div>

          {editId === comment.id ? (
            <div className="mt-3">
              <textarea value={editText} onChange={(event) => setEditText(event.target.value)} maxLength={maxLength} rows={3} className="w-full resize-none rounded-xl border border-white/10 bg-[#0f1115] px-3 py-2.5 text-sm text-white outline-none focus:border-lime-300/35" />
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" disabled={busy} onClick={() => { setEditId(null); setEditText(""); }} className="rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-bold text-gray-400">취소</button>
                <button type="button" disabled={busy} onClick={() => void saveEdit(comment.id)} className="rounded-lg bg-lime-300 px-3 py-1.5 text-[11px] font-black text-black disabled:opacity-50">저장</button>
              </div>
            </div>
          ) : (
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-300">{comment.content}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] font-bold text-gray-600">
            {!isReply && (
              <button type="button" onClick={() => { if (!viewerId) { router.push("/login"); return; } setReplyTo((current) => current === comment.id ? null : comment.id); setReplyText(""); setEditId(null); }} className="hover:text-lime-300">답글 {replies.length > 0 ? replies.length : ""}</button>
            )}
            {own && <button type="button" onClick={() => beginEdit(comment)} className="hover:text-white">수정</button>}
            {own && <button type="button" onClick={() => void deleteComment(comment)} className="hover:text-red-300">삭제</button>}
            {!own && <ReportButton targetType={reportType} targetId={comment.id} reportedUserId={comment.user_id} viewerId={viewerId} />}
            {kind === "squad" && Number(comment.likes_count || 0) > 0 && <span>좋아요 {comment.likes_count}</span>}
          </div>

          {!isReply && replyTo === comment.id && (
            <div className="mt-3 flex gap-2 border-t border-white/[0.06] pt-3">
              <textarea value={replyText} onChange={(event) => setReplyText(event.target.value)} maxLength={maxLength} rows={2} placeholder={`${displayName}님에게 답글 작성`} className="min-w-0 flex-1 resize-none rounded-xl border border-white/10 bg-[#0f1115] px-3 py-2.5 text-sm text-white outline-none placeholder:text-gray-600 focus:border-lime-300/35" />
              <button type="button" disabled={busy} onClick={() => void submitReply(comment.id)} className="rounded-xl bg-lime-300 px-3 text-xs font-black text-black disabled:opacity-50">등록</button>
            </div>
          )}
        </div>

        {!isReply && replies.length > 0 && (
          <div className="mt-2 space-y-2">
            {replies.map((reply) => renderComment(reply, true))}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="mt-5 rounded-2xl border border-white/10 bg-[#15191d] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black">댓글 <span className="text-lime-300">{comments.length}</span></h2>
        {!viewerId && <Link href="/login" className="text-xs font-bold text-lime-300">로그인 후 작성</Link>}
      </div>

      <div className="mt-4 flex gap-2">
        <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={maxLength} rows={3} placeholder={viewerId ? placeholder : "로그인 후 댓글을 작성할 수 있습니다."} className="min-w-0 flex-1 resize-none rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-lime-300/40" />
        <button type="button" disabled={busy} onClick={() => void submitTopLevel()} className="rounded-xl bg-lime-300 px-4 text-sm font-black text-black disabled:opacity-50">등록</button>
      </div>

      {message && <p className="mt-3 text-xs text-amber-300">{message}</p>}

      <div className="mt-5 space-y-3">
        {topLevel.length === 0 && <p className="py-8 text-center text-sm text-gray-600">아직 댓글이 없습니다.</p>}
        {topLevel.map((comment) => renderComment(comment, false))}
      </div>
    </section>
  );
}
