"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getGallerySlots, type GallerySquadData } from "@/lib/fconline/squadGallery";

const STORAGE_KEY = "fc-help-squad-v1";

function addPrice(left: bigint, value: unknown) {
  const text = String(value ?? "");
  return /^\d+$/.test(text) ? left + BigInt(text) : left;
}

export default function SquadShareButton() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function publish() {
    setMessage("");
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setMessage("먼저 스쿼드에 선수를 배치해주세요.");
      return;
    }

    let squad: GallerySquadData;
    try {
      squad = JSON.parse(raw) as GallerySquadData;
    } catch {
      setMessage("저장된 스쿼드를 읽지 못했습니다.");
      return;
    }

    const players = squad.players ?? {};
    const entries = Object.entries(players);
    if (entries.length === 0) {
      setMessage("공유할 선수를 한 명 이상 배치해주세요.");
      return;
    }
    if (!title.trim()) {
      setMessage("제목을 입력해주세요.");
      return;
    }

    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        setMessage("스쿼드 공유는 로그인이 필요합니다.");
        setLoading(false);
        window.setTimeout(() => router.push("/login"), 700);
        return;
      }

      const slots = getGallerySlots(squad);
      let totalSalary = 0;
      let totalValue = BigInt(0);

      const details = await Promise.all(entries.map(async ([slotId, player]) => {
        const slot = slots.find((item) => item.slotId === slotId);
        if (!slot) return null;
        try {
          const response = await fetch(`/api/squad/card?spid=${player.id}&name=${encodeURIComponent(player.name)}&position=${encodeURIComponent(slot.label)}`);
          if (!response.ok) return null;
          const data = await response.json();
          return { salary: Number(data.salary) || 0, price: data.prices?.[player.grade - 1] ?? null };
        } catch {
          return null;
        }
      }));

      details.forEach((item) => {
        if (!item) return;
        totalSalary += item.salary;
        totalValue = addPrice(totalValue, item.price);
      });

      const teamPayload = entries.map(([slotId, player]) => {
        const slot = slots.find((item) => item.slotId === slotId);
        return { slotId, spid: player.id, position: slot?.label ?? player.position ?? "", grade: player.grade };
      });

      let teamColors: string[] = [];
      let averageOvr: number | null = null;
      try {
        const response = await fetch("/api/squad/team-color", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ players: teamPayload }),
        });
        if (response.ok) {
          const data = await response.json();
          teamColors = Array.isArray(data.teamColors)
            ? data.teamColors.map((item: { name?: string }) => item?.name).filter((name: unknown): name is string => typeof name === "string")
            : [];
          const ovrs = Object.values(data.ovrBySlot ?? {}).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
          if (ovrs.length > 0) averageOvr = Math.round((ovrs.reduce((sum, value) => sum + value, 0) / ovrs.length) * 10) / 10;
        }
      } catch {
        // 팀컬러 계산 실패 시에도 공유는 계속 진행한다.
      }

      const authorName = String(user.user_metadata?.display_name || user.user_metadata?.name || user.email?.split("@")[0] || "구단주").slice(0, 40);
      const playerNames = [...new Set(entries.map(([, player]) => player.name))];
      const playerSpids = entries.map(([, player]) => player.id);

      const { data, error } = await supabase
        .from("squad_posts")
        .insert({
          author_id: user.id,
          author_name: authorName,
          title: title.trim().slice(0, 50),
          description: description.trim().slice(0, 500),
          formation: squad.formationKey ?? "직접 배치",
          squad_data: squad,
          player_spids: playerSpids,
          player_names: playerNames,
          team_colors: [...new Set(teamColors)],
          total_salary: totalSalary,
          total_value: totalValue.toString(),
          average_ovr: averageOvr,
          is_public: true,
        })
        .select("id")
        .single();

      if (error) throw error;
      setOpen(false);
      setTitle("");
      setDescription("");
      router.push(`/squad/gallery/${data.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "스쿼드 공유에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-xl bg-lime-300 px-4 py-3 text-sm font-black text-black transition hover:bg-lime-200">
        갤러리에 공유
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={() => !loading && setOpen(false)}>
          <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-[#151a18] p-5 shadow-2xl sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black text-lime-400">SQUAD GALLERY</p>
                <h2 className="mt-1 text-2xl font-black">스쿼드 공유</h2>
              </div>
              <button type="button" disabled={loading} onClick={() => setOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-2xl text-gray-300">×</button>
            </div>

            <label className="mt-6 block text-xs font-bold text-gray-400">제목</label>
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={50} placeholder="예: 현역 레알 6조 스쿼드" className="mt-2 w-full rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-sm outline-none focus:border-lime-400/50" />
            <div className="mt-1 text-right text-[10px] text-gray-600">{title.length}/50</div>

            <label className="mt-4 block text-xs font-bold text-gray-400">소개</label>
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={5} placeholder="스쿼드 컨셉이나 사용 후기를 적어주세요." className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-sm outline-none focus:border-lime-400/50" />
            <div className="mt-1 text-right text-[10px] text-gray-600">{description.length}/500</div>

            {message && <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-xs text-amber-200">{message}</p>}

            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" disabled={loading} onClick={() => setOpen(false)} className="rounded-xl border border-white/15 py-3 text-sm font-bold text-gray-300 disabled:opacity-50">취소</button>
              <button type="button" disabled={loading} onClick={() => void publish()} className="rounded-xl bg-lime-300 py-3 text-sm font-black text-black disabled:opacity-50">
                {loading ? "공유 중..." : "피드 공유"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
