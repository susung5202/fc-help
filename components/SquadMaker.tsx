"use client";

import { useEffect, useMemo, useState } from "react";
import PlayerArtwork from "@/components/PlayerArtwork";
import { getEnhancementBadgeTone } from "@/lib/ui/enhancementBadge";

type SearchPlayer = {
  id: number;
  name: string;
  seasonName: string;
  seasonImg: string | null;
  ovr: number | null;
  position: string | null;
};

type SquadPlayer = SearchPlayer & {
  grade: number;
};

type Slot = {
  slotId: string;
  label: string;
  x: number;
  y: number;
};

type Formation = {
  name: string;
  slots: Slot[];
};

const FORMATIONS: Record<string, Formation> = {
  "4-2-3-1": {
    name: "4-2-3-1",
    slots: [
      { slotId: "p0", label: "ST", x: 50, y: 10 },
      { slotId: "p1", label: "LAM", x: 24, y: 27 },
      { slotId: "p2", label: "CAM", x: 50, y: 25 },
      { slotId: "p3", label: "RAM", x: 76, y: 27 },
      { slotId: "p4", label: "CDM", x: 38, y: 45 },
      { slotId: "p5", label: "CDM", x: 62, y: 45 },
      { slotId: "p6", label: "LB", x: 15, y: 67 },
      { slotId: "p7", label: "CB", x: 38, y: 64 },
      { slotId: "p8", label: "CB", x: 62, y: 64 },
      { slotId: "p9", label: "RB", x: 85, y: 67 },
      { slotId: "p10", label: "GK", x: 50, y: 86 },
    ],
  },
  "4-3-3": {
    name: "4-3-3",
    slots: [
      { slotId: "p0", label: "LW", x: 20, y: 15 },
      { slotId: "p1", label: "ST", x: 50, y: 9 },
      { slotId: "p2", label: "RW", x: 80, y: 15 },
      { slotId: "p3", label: "CM", x: 28, y: 40 },
      { slotId: "p4", label: "CM", x: 50, y: 35 },
      { slotId: "p5", label: "CM", x: 72, y: 40 },
      { slotId: "p6", label: "LB", x: 15, y: 67 },
      { slotId: "p7", label: "CB", x: 38, y: 64 },
      { slotId: "p8", label: "CB", x: 62, y: 64 },
      { slotId: "p9", label: "RB", x: 85, y: 67 },
      { slotId: "p10", label: "GK", x: 50, y: 86 },
    ],
  },
  "4-1-2-3": {
    name: "4-1-2-3",
    slots: [
      { slotId: "p0", label: "LW", x: 19, y: 15 },
      { slotId: "p1", label: "ST", x: 50, y: 9 },
      { slotId: "p2", label: "RW", x: 81, y: 15 },
      { slotId: "p3", label: "CM", x: 32, y: 38 },
      { slotId: "p4", label: "CM", x: 68, y: 38 },
      { slotId: "p5", label: "CDM", x: 50, y: 53 },
      { slotId: "p6", label: "LB", x: 15, y: 68 },
      { slotId: "p7", label: "CB", x: 38, y: 65 },
      { slotId: "p8", label: "CB", x: 62, y: 65 },
      { slotId: "p9", label: "RB", x: 85, y: 68 },
      { slotId: "p10", label: "GK", x: 50, y: 86 },
    ],
  },
  "4-2-2-2": {
    name: "4-2-2-2",
    slots: [
      { slotId: "p0", label: "ST", x: 37, y: 10 },
      { slotId: "p1", label: "ST", x: 63, y: 10 },
      { slotId: "p2", label: "LAM", x: 24, y: 30 },
      { slotId: "p3", label: "RAM", x: 76, y: 30 },
      { slotId: "p4", label: "CDM", x: 38, y: 47 },
      { slotId: "p5", label: "CDM", x: 62, y: 47 },
      { slotId: "p6", label: "LB", x: 15, y: 68 },
      { slotId: "p7", label: "CB", x: 38, y: 65 },
      { slotId: "p8", label: "CB", x: 62, y: 65 },
      { slotId: "p9", label: "RB", x: 85, y: 68 },
      { slotId: "p10", label: "GK", x: 50, y: 86 },
    ],
  },
  "4-4-2": {
    name: "4-4-2",
    slots: [
      { slotId: "p0", label: "ST", x: 37, y: 10 },
      { slotId: "p1", label: "ST", x: 63, y: 10 },
      { slotId: "p2", label: "LM", x: 18, y: 38 },
      { slotId: "p3", label: "CM", x: 40, y: 40 },
      { slotId: "p4", label: "CM", x: 60, y: 40 },
      { slotId: "p5", label: "RM", x: 82, y: 38 },
      { slotId: "p6", label: "LB", x: 15, y: 68 },
      { slotId: "p7", label: "CB", x: 38, y: 65 },
      { slotId: "p8", label: "CB", x: 62, y: 65 },
      { slotId: "p9", label: "RB", x: 85, y: 68 },
      { slotId: "p10", label: "GK", x: 50, y: 86 },
    ],
  },
  "3-5-2": {
    name: "3-5-2",
    slots: [
      { slotId: "p0", label: "ST", x: 37, y: 10 },
      { slotId: "p1", label: "ST", x: 63, y: 10 },
      { slotId: "p2", label: "LM", x: 15, y: 37 },
      { slotId: "p3", label: "CAM", x: 50, y: 30 },
      { slotId: "p4", label: "RM", x: 85, y: 37 },
      { slotId: "p5", label: "CDM", x: 38, y: 50 },
      { slotId: "p6", label: "CDM", x: 62, y: 50 },
      { slotId: "p7", label: "CB", x: 25, y: 68 },
      { slotId: "p8", label: "CB", x: 50, y: 64 },
      { slotId: "p9", label: "CB", x: 75, y: 68 },
      { slotId: "p10", label: "GK", x: 50, y: 86 },
    ],
  },
};

const STORAGE_KEY = "fc-help-squad-v1";

export default function SquadMaker() {
  const [formationKey, setFormationKey] = useState("4-2-3-1");
  const [players, setPlayers] = useState<Record<string, SquadPlayer>>({});
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [grade, setGrade] = useState(1);
  const [hydrated, setHydrated] = useState(false);

  const formation = FORMATIONS[formationKey] ?? FORMATIONS["4-2-3-1"];
  const selectedSlot = formation.slots.find((slot) => slot.slotId === selectedSlotId) ?? null;
  const selectedPlayer = selectedSlotId ? players[selectedSlotId] ?? null : null;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          formationKey?: string;
          players?: Record<string, SquadPlayer>;
        };
        if (saved.formationKey && FORMATIONS[saved.formationKey]) {
          setFormationKey(saved.formationKey);
        }
        if (saved.players) setPlayers(saved.players);
      }
    } catch {
      // 잘못된 로컬 저장값은 무시한다.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ formationKey, players })
    );
  }, [formationKey, players, hydrated]);

  useEffect(() => {
    if (!selectedSlotId || query.trim().length < 1) {
      setResults([]);
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/squad/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "선수 검색 실패");
        setResults(data.items ?? []);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(requestError instanceof Error ? requestError.message : "선수 검색에 실패했습니다.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, selectedSlotId]);

  const selectedPlayers = Object.values(players);
  const averageOvr = useMemo(() => {
    const ovrs = selectedPlayers
      .map((player) => player.ovr)
      .filter((value): value is number => value !== null);
    if (ovrs.length === 0) return null;
    return Math.round((ovrs.reduce((sum, value) => sum + value, 0) / ovrs.length) * 10) / 10;
  }, [selectedPlayers]);

  function openSlot(slotId: string) {
    const current = players[slotId];
    setSelectedSlotId(slotId);
    setGrade(current?.grade ?? 1);
    setQuery("");
    setResults([]);
    setError("");
  }

  function closePanel() {
    setSelectedSlotId(null);
    setQuery("");
    setResults([]);
    setError("");
  }

  function choosePlayer(player: SearchPlayer) {
    if (!selectedSlotId) return;
    setPlayers((current) => ({
      ...current,
      [selectedSlotId]: { ...player, grade },
    }));
    closePanel();
  }

  function updateCurrentGrade(nextGrade: number) {
    setGrade(nextGrade);
    if (!selectedSlotId || !players[selectedSlotId]) return;
    setPlayers((current) => ({
      ...current,
      [selectedSlotId]: {
        ...current[selectedSlotId],
        grade: nextGrade,
      },
    }));
  }

  function removeCurrentPlayer() {
    if (!selectedSlotId) return;
    setPlayers((current) => {
      const next = { ...current };
      delete next[selectedSlotId];
      return next;
    });
    closePanel();
  }

  function clearSquad() {
    if (!window.confirm("현재 스쿼드를 모두 비울까요?")) return;
    setPlayers({});
    closePanel();
  }

  const panel = selectedSlot ? (
    <PlayerPickerPanel
      slot={selectedSlot}
      currentPlayer={selectedPlayer}
      query={query}
      onQueryChange={setQuery}
      results={results}
      loading={loading}
      error={error}
      grade={grade}
      onGradeChange={updateCurrentGrade}
      onChoose={choosePlayer}
      onRemove={removeCurrentPlayer}
      onClose={closePanel}
    />
  ) : (
    <div className="rounded-3xl border border-white/10 bg-[#181b21] p-7 text-center">
      <p className="text-sm font-semibold text-lime-400">PLAYER SELECT</p>
      <h2 className="mt-2 text-xl font-bold">포지션을 선택하세요</h2>
      <p className="mt-3 text-sm leading-6 text-gray-500">
        경기장 위 포지션을 누르면 선수를 검색하고 시즌과 강화 단계를 선택할 수 있습니다.
      </p>
    </div>
  );

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#181b21] p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/10 px-4 py-3">
            <span className="text-xs font-semibold text-gray-500">포메이션</span>
            <select
              value={formationKey}
              onChange={(event) => setFormationKey(event.target.value)}
              className="bg-transparent text-sm font-bold text-white outline-none"
            >
              {Object.keys(FORMATIONS).map((key) => (
                <option key={key} value={key} className="bg-[#181b21]">
                  {key}
                </option>
              ))}
            </select>
          </label>

          <SummaryBadge label="선수" value={`${selectedPlayers.length}/11`} />
          <SummaryBadge label="평균 OVR" value={averageOvr === null ? "-" : String(averageOvr)} />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-600">이 기기에 자동 저장</span>
          <button
            type="button"
            onClick={clearSquad}
            className="rounded-xl border border-red-400/20 px-4 py-2.5 text-sm font-bold text-red-300 transition hover:bg-red-400/5"
          >
            전체 초기화
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_410px]">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#101b14] p-3 sm:p-5">
          <div className="relative mx-auto aspect-[0.78] w-full max-w-[760px] overflow-hidden rounded-2xl border-2 border-white/20 bg-[linear-gradient(180deg,#1c6b3a_0%,#185f34_50%,#14532d_100%)] shadow-inner shadow-black/30">
            <PitchLines />

            {formation.slots.map((slot) => (
              <SquadSlotButton
                key={slot.slotId}
                slot={slot}
                player={players[slot.slotId]}
                active={slot.slotId === selectedSlotId}
                onClick={() => openSlot(slot.slotId)}
              />
            ))}
          </div>
        </div>

        <aside className="hidden xl:block">{panel}</aside>
      </div>

      {selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 px-3 pt-10 xl:hidden">
          <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl">{panel}</div>
        </div>
      )}
    </div>
  );
}

function SummaryBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-24 rounded-xl border border-white/10 bg-black/10 px-4 py-3">
      <p className="text-[11px] font-semibold text-gray-500">{label}</p>
      <p className="mt-0.5 text-lg font-black">{value}</p>
    </div>
  );
}

function PitchLines() {
  return (
    <div className="pointer-events-none absolute inset-5 opacity-70">
      <div className="absolute inset-0 rounded-sm border-2 border-white/45" />
      <div className="absolute left-0 right-0 top-1/2 border-t-2 border-white/45" />
      <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/45 sm:h-32 sm:w-32" />
      <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/60" />
      <div className="absolute left-1/2 top-0 h-[15%] w-[54%] -translate-x-1/2 border-x-2 border-b-2 border-white/45" />
      <div className="absolute bottom-0 left-1/2 h-[15%] w-[54%] -translate-x-1/2 border-x-2 border-t-2 border-white/45" />
      <div className="absolute left-1/2 top-0 h-[6%] w-[25%] -translate-x-1/2 border-x-2 border-b-2 border-white/45" />
      <div className="absolute bottom-0 left-1/2 h-[6%] w-[25%] -translate-x-1/2 border-x-2 border-t-2 border-white/45" />
    </div>
  );
}

function SquadSlotButton({
  slot,
  player,
  active,
  onClick,
}: {
  slot: Slot;
  player?: SquadPlayer;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition ${active ? "scale-105" : "hover:scale-105"}`}
      style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
    >
      {player ? (
        <div className="relative w-[74px] sm:w-[92px]">
          <div className="relative h-[78px] overflow-hidden rounded-2xl border border-white/20 bg-black/35 shadow-xl sm:h-[96px]">
            {player.seasonImg && (
              <img
                src={player.seasonImg}
                alt={player.seasonName}
                className="absolute left-1.5 top-1.5 z-20 h-5 max-w-8 object-contain sm:h-6 sm:max-w-10"
              />
            )}
            <span
              className={`absolute right-1.5 top-1.5 z-20 rounded-md border px-1.5 py-0.5 text-[10px] font-black ${getEnhancementBadgeTone(player.grade)}`}
            >
              +{player.grade}
            </span>
            <PlayerArtwork
              key={player.id}
              spid={player.id}
              alt={player.name}
              className="absolute bottom-0 left-1/2 max-h-[80px] max-w-[125%] -translate-x-1/2 object-contain sm:max-h-[98px]"
            />
          </div>
          <div className="mt-1 rounded-lg bg-black/75 px-1.5 py-1 shadow-lg backdrop-blur">
            <p className="truncate text-[10px] font-black text-white sm:text-xs">{player.name}</p>
            <p className="mt-0.5 text-[9px] font-bold text-lime-300 sm:text-[10px]">
              {slot.label} · OVR {player.ovr ?? "-"}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-white/45 bg-black/25 text-xl font-light text-white/80 shadow-lg sm:h-14 sm:w-14">
            +
          </div>
          <span className="mt-1 rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-black text-white sm:text-xs">
            {slot.label}
          </span>
        </>
      )}
    </button>
  );
}

function PlayerPickerPanel({
  slot,
  currentPlayer,
  query,
  onQueryChange,
  results,
  loading,
  error,
  grade,
  onGradeChange,
  onChoose,
  onRemove,
  onClose,
}: {
  slot: Slot;
  currentPlayer: SquadPlayer | null;
  query: string;
  onQueryChange: (value: string) => void;
  results: SearchPlayer[];
  loading: boolean;
  error: string;
  grade: number;
  onGradeChange: (grade: number) => void;
  onChoose: (player: SearchPlayer) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#181b21] p-5 shadow-2xl sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-lime-400">{slot.label} PLAYER</p>
          <h2 className="mt-1 text-2xl font-black">선수 선택</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-xl text-gray-400 hover:text-white"
        >
          ×
        </button>
      </div>

      {currentPlayer && (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-lime-400/20 bg-lime-400/5 p-3">
          {currentPlayer.seasonImg && (
            <img src={currentPlayer.seasonImg} alt={currentPlayer.seasonName} className="h-8 w-10 object-contain" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{currentPlayer.name}</p>
            <p className="text-xs text-gray-500">{currentPlayer.seasonName} · OVR {currentPlayer.ovr ?? "-"}</p>
          </div>
          <button type="button" onClick={onRemove} className="text-xs font-bold text-red-300 hover:text-red-200">
            제거
          </button>
        </div>
      )}

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-bold">강화 단계</p>
          <span className={`rounded-md border px-2 py-1 text-xs font-black ${getEnhancementBadgeTone(grade)}`}>+{grade}</span>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 13 }, (_, index) => index + 1).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => onGradeChange(level)}
              className={`rounded-lg border py-2 text-xs font-black transition ${getEnhancementBadgeTone(level)} ${grade === level ? "ring-2 ring-white/60 opacity-100" : "opacity-65 hover:opacity-100"}`}
            >
              +{level}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="선수 이름 검색"
          autoFocus
          className="w-full rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-lime-400/50"
        />
        <p className="mt-2 text-[11px] text-gray-600">검색 결과는 기본 OVR 높은 순으로 표시됩니다.</p>
      </div>

      <div className="mt-4 max-h-[48vh] space-y-2 overflow-y-auto pr-1 xl:max-h-[580px]">
        {loading && <p className="py-8 text-center text-sm text-gray-500">선수 정보를 불러오는 중...</p>}
        {!loading && error && <p className="rounded-xl bg-red-400/5 p-4 text-sm text-red-300">{error}</p>}
        {!loading && !error && query.trim() && results.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500">검색 결과가 없습니다.</p>
        )}
        {!loading && !error && results.map((player) => (
          <button
            key={player.id}
            type="button"
            onClick={() => onChoose(player)}
            className="flex w-full items-center gap-3 rounded-xl border border-white/[0.08] bg-black/10 p-3 text-left transition hover:border-lime-400/30 hover:bg-lime-400/[0.04]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
              {player.seasonImg ? (
                <img src={player.seasonImg} alt={player.seasonName} className="max-h-9 max-w-10 object-contain" />
              ) : (
                <span className="text-xs text-gray-700">-</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{player.name}</p>
              <p className="mt-1 truncate text-xs text-gray-500">{player.seasonName}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-lime-300">{player.ovr ?? "-"}</p>
              <p className="text-[10px] font-bold text-gray-500">{player.position ?? "OVR"}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
