"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CATEGORIES = [
  ["free", "자유"],
  ["question", "질문"],
  ["tip", "팁·정보"],
  ["squad", "스쿼드"],
] as const;

type Category = (typeof CATEGORIES)[number][0];

export default function CommunityWrite() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [category, setCategory] = useState<Category>("free");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    if (saving) return;
    const nextTitle = title.trim();
    const nextContent = content.trim();
    if (!nextTitle) { setMessage("제목을 입력해주세요."); return; }
    if (!nextContent) { setMessage("내용을 입력해주세요."); return; }

    setSaving(true);
    setMessage("");

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      setSaving(false);
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("community_posts")
      .insert({ author_id: user.id, category, title: nextTitle, content: nextContent })
      .select("id")
      .single();

    if (error || !data) {
      setMessage(error?.message || "게시글을 등록하지 못했습니다.");
      setSaving(false);
      return;
    }

    router.push(`/community/${data.id}`);
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-lime-400">COMMUNITY</p>
          <h1 className="mt-1 text-3xl font-black">새 글 작성</h1>
        </div>
        <Link href="/community" className="text-sm font-bold text-gray-400 hover:text-white">취소</Link>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-[#15191d] p-4 sm:p-6">
        <label className="text-xs font-black text-gray-400">카테고리</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATEGORIES.map(([value, label]) => (
            <button key={value} type="button" onClick={() => setCategory(value)} className={`rounded-full border px-3.5 py-2 text-xs font-black ${category === value ? "border-lime-300/40 bg-lime-300/10 text-lime-300" : "border-white/10 text-gray-400"}`}>
              {label}
            </button>
          ))}
        </div>

        <label className="mt-6 block text-xs font-black text-gray-400">제목</label>
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder="제목을 입력하세요" className="mt-2 w-full rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-lime-300/40" />
        <div className="mt-1 text-right text-[10px] text-gray-600">{title.length}/80</div>

        <label className="mt-4 block text-xs font-black text-gray-400">내용</label>
        <textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={5000} rows={14} placeholder="FC Online 이야기를 자유롭게 작성해보세요." className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-gray-600 focus:border-lime-300/40" />
        <div className="mt-1 text-right text-[10px] text-gray-600">{content.length}/5000</div>

        {message && <p className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/5 px-3 py-2 text-xs text-amber-100">{message}</p>}

        <div className="mt-6 grid grid-cols-2 gap-2">
          <Link href="/community" className="rounded-xl border border-white/15 py-3 text-center text-sm font-bold text-gray-300">취소</Link>
          <button type="button" disabled={saving} onClick={() => void submit()} className="rounded-xl bg-lime-300 py-3 text-sm font-black text-black disabled:opacity-50">
            {saving ? "등록 중..." : "게시글 등록"}
          </button>
        </div>
      </div>
    </div>
  );
}
