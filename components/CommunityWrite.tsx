"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const CATEGORIES = [
  ["free", "자유"],
  ["question", "질문"],
  ["tip", "팁·정보"],
  ["squad", "스쿼드"],
] as const;

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES = 4;

type Category = (typeof CATEGORIES)[number][0];
type ExistingImage = { url: string; path: string };
type PendingImage = { file: File; preview: string };

type EditablePost = {
  id: string;
  author_id: string;
  category: Category;
  title: string;
  content: string;
  image_urls: string[] | null;
  image_paths: string[] | null;
};

function fileExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export default function CommunityWrite({ postId }: { postId?: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const editing = Boolean(postId);
  const [category, setCategory] = useState<Category>("free");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [removedPaths, setRemovedPaths] = useState<string[]>([]);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!postId) return;
    let active = true;

    async function loadPost() {
      setLoading(true);
      setMessage("");

      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("community_posts")
        .select("id,author_id,category,title,content,image_urls,image_paths")
        .eq("id", postId)
        .maybeSingle();

      if (!active) return;
      if (error || !data) {
        setMessage(error?.message || "게시글을 찾을 수 없습니다.");
        setLoading(false);
        return;
      }

      const post = data as EditablePost;
      if (post.author_id !== user.id) {
        setMessage("본인이 작성한 게시글만 수정할 수 있습니다.");
        setLoading(false);
        return;
      }

      const urls = Array.isArray(post.image_urls) ? post.image_urls : [];
      const paths = Array.isArray(post.image_paths) ? post.image_paths : [];
      setCategory(post.category);
      setTitle(post.title);
      setContent(post.content);
      setExistingImages(urls.map((url, index) => ({ url, path: paths[index] ?? "" })).filter((image) => image.path));
      setLoading(false);
    }

    void loadPost();
    return () => {
      active = false;
    };
  }, [postId, router, supabase]);

  function addImages(files: FileList | null) {
    if (!files) return;
    const currentCount = existingImages.length + pendingImages.length;
    const remaining = MAX_IMAGES - currentCount;
    if (remaining <= 0) {
      setMessage(`사진은 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다.`);
      return;
    }

    const selected = Array.from(files).slice(0, remaining);
    for (const file of selected) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
        setMessage("JPG, PNG, WebP 이미지만 첨부할 수 있습니다.");
        return;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setMessage("사진 한 장당 최대 5MB까지 첨부할 수 있습니다.");
        return;
      }
    }

    Promise.all(
      selected.map(
        (file) =>
          new Promise<PendingImage>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ file, preview: String(reader.result ?? "") });
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          })
      )
    )
      .then((images) => {
        setPendingImages((current) => [...current, ...images].slice(0, MAX_IMAGES - existingImages.length));
        setMessage("");
      })
      .catch(() => setMessage("사진 미리보기를 만들지 못했습니다."));
  }

  function removeExistingImage(index: number) {
    setExistingImages((current) => {
      const target = current[index];
      if (target?.path) setRemovedPaths((paths) => [...paths, target.path]);
      return current.filter((_, imageIndex) => imageIndex !== index);
    });
  }

  function removePendingImage(index: number) {
    setPendingImages((current) => current.filter((_, imageIndex) => imageIndex !== index));
  }

  async function submit() {
    if (saving) return;
    const nextTitle = title.trim();
    const nextContent = content.trim();
    if (!nextTitle) {
      setMessage("제목을 입력해주세요.");
      return;
    }
    if (!nextContent) {
      setMessage("내용을 입력해주세요.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      setSaving(false);
      router.push("/login");
      return;
    }

    const targetPostId = postId ?? crypto.randomUUID();
    const uploadedPaths: string[] = [];

    try {
      const uploaded = await Promise.all(
        pendingImages.map(async ({ file }) => {
          const path = `${user.id}/${targetPostId}/${crypto.randomUUID()}.${fileExtension(file)}`;
          const { error: uploadError } = await supabase.storage.from("community-media").upload(path, file, {
            cacheControl: "3600",
            contentType: file.type,
            upsert: false,
          });
          if (uploadError) throw uploadError;
          uploadedPaths.push(path);
          const { data: publicData } = supabase.storage.from("community-media").getPublicUrl(path);
          return { path, url: publicData.publicUrl };
        })
      );

      const allImages = [...existingImages, ...uploaded];
      const payload = {
        category,
        title: nextTitle,
        content: nextContent,
        image_urls: allImages.map((image) => image.url),
        image_paths: allImages.map((image) => image.path),
        updated_at: new Date().toISOString(),
      };

      if (editing) {
        const { data: updated, error } = await supabase
          .from("community_posts")
          .update(payload)
          .eq("id", targetPostId)
          .eq("author_id", user.id)
          .select("id")
          .maybeSingle();
        if (error || !updated) throw error ?? new Error("게시글을 수정할 수 없습니다.");
      } else {
        const { data: inserted, error } = await supabase
          .from("community_posts")
          .insert({ id: targetPostId, author_id: user.id, ...payload })
          .select("id")
          .single();
        if (error || !inserted) throw error ?? new Error("게시글을 등록하지 못했습니다.");
      }

      if (removedPaths.length > 0) {
        const { error: removeError } = await supabase.storage.from("community-media").remove(removedPaths);
        if (removeError) console.warn("Community image cleanup failed", removeError);
      }

      router.push(`/community/${targetPostId}`);
      router.refresh();
    } catch (error) {
      if (uploadedPaths.length > 0) {
        await supabase.storage.from("community-media").remove(uploadedPaths).catch(() => undefined);
      }
      setMessage(error instanceof Error ? error.message : editing ? "게시글을 수정하지 못했습니다." : "게시글을 등록하지 못했습니다.");
      setSaving(false);
    }
  }

  const imageCount = existingImages.length + pendingImages.length;
  const cancelHref = postId ? `/community/${postId}` : "/community";

  if (loading) {
    return <div className="mx-auto max-w-3xl px-4 py-20 text-center text-sm text-gray-500">게시글을 불러오는 중...</div>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-lime-400">COMMUNITY</p>
          <h1 className="mt-1 text-3xl font-black">{editing ? "게시글 수정" : "새 글 작성"}</h1>
        </div>
        <Link href={cancelHref} className="text-sm font-bold text-gray-400 hover:text-white">취소</Link>
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

        <div className="mt-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-gray-400">사진</p>
            <p className="mt-1 text-[10px] text-gray-600">JPG, PNG, WebP · 장당 최대 5MB · 최대 4장</p>
          </div>
          <label className={`cursor-pointer rounded-lg border px-3 py-2 text-xs font-black ${imageCount >= MAX_IMAGES ? "pointer-events-none border-white/5 text-gray-700" : "border-lime-300/25 bg-lime-300/[0.06] text-lime-300"}`}>
            사진 추가 {imageCount}/{MAX_IMAGES}
            <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" disabled={imageCount >= MAX_IMAGES} onChange={(event) => { addImages(event.target.files); event.currentTarget.value = ""; }} />
          </label>
        </div>

        {imageCount > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {existingImages.map((image, index) => (
              <div key={image.path} className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-black/20">
                <img src={image.url} alt={`첨부 사진 ${index + 1}`} className="h-full w-full object-cover" />
                <button type="button" onClick={() => removeExistingImage(index)} className="absolute right-1.5 top-1.5 rounded-full bg-black/75 px-2 py-1 text-[10px] font-black text-white">삭제</button>
              </div>
            ))}
            {pendingImages.map((image, index) => (
              <div key={`${image.file.name}-${image.file.lastModified}-${index}`} className="relative aspect-square overflow-hidden rounded-xl border border-lime-300/20 bg-black/20">
                <img src={image.preview} alt={`새 첨부 사진 ${index + 1}`} className="h-full w-full object-cover" />
                <span className="absolute bottom-1.5 left-1.5 rounded bg-lime-300 px-1.5 py-0.5 text-[9px] font-black text-black">NEW</span>
                <button type="button" onClick={() => removePendingImage(index)} className="absolute right-1.5 top-1.5 rounded-full bg-black/75 px-2 py-1 text-[10px] font-black text-white">삭제</button>
              </div>
            ))}
          </div>
        )}

        {message && <p className="mt-3 rounded-xl border border-amber-300/15 bg-amber-300/5 px-3 py-2 text-xs text-amber-100">{message}</p>}

        <div className="mt-6 grid grid-cols-2 gap-2">
          <Link href={cancelHref} className="rounded-xl border border-white/15 py-3 text-center text-sm font-bold text-gray-300">취소</Link>
          <button type="button" disabled={saving} onClick={() => void submit()} className="rounded-xl bg-lime-300 py-3 text-sm font-black text-black disabled:opacity-50">
            {saving ? (editing ? "수정 중..." : "등록 중...") : (editing ? "수정 완료" : "게시글 등록")}
          </button>
        </div>
      </div>
    </div>
  );
}
