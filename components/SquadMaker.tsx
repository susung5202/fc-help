"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import PlayerArtwork from "@/components/PlayerArtwork";
import { getEnhancementBadgeTone } from "@/lib/ui/enhancementBadge";

type SearchPlayer = {
  id: number;
  name: string;
  seasonName: string;
  seasonImg: string | null;
  ovr: number | null;
  position: string | null;
  newTraits: string[];
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

type CustomPosition = {
  x: number;
  y: number;
};

type DragState = {
  slotId: string;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  latestClientX: number;
  latestClientY: number;
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function withTraitDefaults(player: SquadPlayer): SquadPlayer {
  return {
    ...player,
    newTraits: Array.isArray(player.newTraits) ? player.newTraits : [],
  };
}

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
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);
  const [dropTargetSlotId, setDropTargetSlotId] = useState<string | null>(null);
  const [dragPosition, setDragPosition] = useState<CustomPosition | null>(null);

  const pitchRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const skipClickRef = useRef<string | null>(null);

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

        if (saved.players) {
          setPlayers(
            Object.fromEntries(
              Object.entries(saved.players).map(([slotId, player]) => [
                slotId,
                withTraitDefaults(player),
              ])
            )
          );
        }

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
        const response = await fetch(
          `/api/squad/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "선수 검색 실패");

        const items = (data.items ?? []) as SearchPlayer[];
        setResults(
          items.map((player) => ({
            ...player,
            newTraits: Array.isArray(player.newTraits) ? player.newTraits : [],
          }))
        );
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "선수 검색에 실패했습니다."
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, selectedSlotId]);

  const selectedPlayers = Object.values(players) as SquadPlayer[];
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
      [selectedSlotId]: {
        ...player,
        newTraits: player.newTraits ?? [],
        grade,
      },
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

  function resetCurrentPositions() {
    dragStateRef.current = null;
    setDraggingSlotId(null);
    setDropTargetSlotId(null);
    setDragPosition(null);
  }

  function handleFormationChange(nextFormation: string) {
    setFormationKey(nextFormation);
    closePanel();
  }

  function findDropTarget(clientX: number, clientY: number, rect: DOMRect): Slot | null {
    const hitboxWidth = clamp(rect.width * 0.24, 88, 170);
    const hitboxHeight = clamp(rect.height * 0.14, 72, 118);
    let best: { slot: Slot; distance: number } | null = null;

    for (const slot of formation.slots) {
      const centerX = rect.left + (slot.x / 100) * rect.width;
      const centerY = rect.top + (slot.y / 100) * rect.height;
      const dx = clientX - centerX;
      const dy = clientY - centerY;

      if (Math.abs(dx) > hitboxWidth / 2 || Math.abs(dy) > hitboxHeight / 2) continue;

      const distance = Math.hypot(dx / hitboxWidth, dy / hitboxHeight);
      if (!best || distance < best.distance) {
        best = { slot, distance };
      }
    }

    return best?.slot ?? null;
  }

  function beginDrag(slotId: string, event: ReactPointerEvent<HTMLButtonElement>) {
    if (!players[slotId]) return;

    const slot = formation.slots.find((item) => item.slotId === slotId);
    if (!slot) return;

    dragStateRef.current = {
      slotId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      latestClientX: event.clientX,
      latestClientY: event.clientY,
    };

    setDraggingSlotId(slotId);
    setDropTargetSlotId(slotId);
    setDragPosition({ x: slot.x, y: slot.y });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(slotId: string, event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragStateRef.current;
    if (!drag || drag.slotId !== slotId || drag.pointerId !== event.pointerId) return;

    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.moved && distance < 5) return;
    drag.moved = true;

    const rect = pitchRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;

    const position = {
      x: clamp(((event.clientX - rect.left) / rect.width) * 100, 8, 92),
      y: clamp(((event.clientY - rect.top) / rect.height) * 100, 7, 93),
    };
    drag.latestClientX = event.clientX;
    drag.latestClientY = event.clientY;
    setDragPosition(position);

    const target = findDropTarget(event.clientX, event.clientY, rect);
    setDropTargetSlotId(target?.slotId ?? null);
    event.preventDefault();
  }

  function finishDrag(
    slotId: string,
    event: ReactPointerEvent<HTMLButtonElement>,
    cancelled = false
  ) {
    const drag = dragStateRef.current;
    if (!drag || drag.slotId !== slotId || drag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (drag.moved) {
      skipClickRef.current = slotId;

      if (!cancelled) {
        const rect = pitchRef.current?.getBoundingClientRect();
        const target = rect
          ? findDropTarget(drag.latestClientX, drag.latestClientY, rect)
          : null;

        if (target && target.slotId !== slotId) {
          // 포지션 슬롯의 라벨/좌표는 유지하고 선수만 슬롯 사이에서 교환한다.
          // 빈 슬롯으로 이동하면 출발 슬롯은 원래 포지션의 빈칸으로 남는다.
          setPlayers((current) => {
            const movingPlayer = current[slotId];
            if (!movingPlayer) return current;

            const targetPlayer = current[target.slotId];
            const next = { ...current };
            next[target.slotId] = movingPlayer;

            if (targetPlayer) {
              next[slotId] = targetPlayer;
            } else {
              delete next[slotId];
            }

            return next;
          });

          closePanel();
        }
      }
    }

    dragStateRef.current = null;
    setDraggingSlotId(null);
    setDropTargetSlotId(null);
    setDragPosition(null);
  }

  function handleSlotClick(slotId: string) {
    if (skipClickRef.current === slotId) {
      skipClickRef.current = null;
      return;
    }

    openSlot(slotId);
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
        배치한 선수를 마우스나 터치로 끌면 포지션 드롭 영역이 표시됩니다.
        원하는 포지션에 놓으면 빈 자리로 이동하거나 두 선수의 자리가 서로 바뀝니다.
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
              onChange={(event) => handleFormationChange(event.target.value)}
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

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="text-xs text-gray-600">이 기기에 자동 저장</span>
          <button
            type="button"
            onClick={resetCurrentPositions}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-gray-300 transition hover:bg-white/5"
          >
            위치 초기화
          </button>
          <button
            type="button"
            onClick={clearSquad}
            className="rounded-xl border border-red-400/20 px-4 py-2.5 text-sm font-bold text-red-300 transition hover:bg-red-400/5"
          >
            전체 초기화
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
          선수 드래그 → 포지션 영역 표시
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
          포지션에 놓기 → 이동 또는 선수 교환
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5">
          선수 카드 클릭 → 선수/강화 변경
        </span>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_410px]">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#101b14] p-3 sm:p-5">
          <div
            ref={pitchRef}
            className="relative mx-auto aspect-[0.78] w-full max-w-[760px] overflow-hidden rounded-2xl border-2 border-white/20 bg-[linear-gradient(180deg,#1c6b3a_0%,#185f34_50%,#14532d_100%)] shadow-inner shadow-black/30"
          >
            <PitchLines />

            {draggingSlotId &&
              formation.slots.map((slot) => (
                <PositionHitbox
                  key={`hitbox-${slot.slotId}`}
                  slot={slot}
                  active={slot.slotId === dropTargetSlotId}
                />
              ))}

            {formation.slots.map((slot) => {
              const renderedSlot =
                slot.slotId === draggingSlotId && dragPosition
                  ? { ...slot, ...dragPosition }
                  : slot;
              return (
                <SquadSlotButton
                  key={slot.slotId}
                  slot={renderedSlot}
                  player={players[slot.slotId]}
                  active={slot.slotId === selectedSlotId}
                  dragging={slot.slotId === draggingSlotId}
                  dropTarget={slot.slotId === dropTargetSlotId}
                  onClick={() => handleSlotClick(slot.slotId)}
                  onPointerDown={(event) => beginDrag(slot.slotId, event)}
                  onPointerMove={(event) => moveDrag(slot.slotId, event)}
                  onPointerUp={(event) => finishDrag(slot.slotId, event)}
                  onPointerCancel={(event) => finishDrag(slot.slotId, event, true)}
                />
              );
            })}
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

function PositionHitbox({ slot, active }: { slot: Slot; active: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-start justify-center rounded-2xl border-2 border-dashed pt-1.5 transition sm:pt-2 ${
        active
          ? "border-lime-300 bg-lime-300/20 shadow-[0_0_30px_rgba(190,242,100,0.25)]"
          : "border-white/35 bg-black/10"
      }`}
      style={{
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        width: "clamp(88px, 24%, 170px)",
        height: "clamp(72px, 14%, 118px)",
      }}
      aria-hidden="true"
    >
      <span
        className={`rounded-full border px-2 py-0.5 text-[9px] font-black backdrop-blur sm:text-[10px] ${
          active
            ? "border-lime-200/70 bg-lime-300/25 text-lime-50"
            : "border-white/20 bg-black/35 text-white/65"
        }`}
      >
        {slot.label}
      </span>
    </div>
  );
}

function SquadSlotButton({
  slot,
  player,
  active,
  dragging,
  dropTarget,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  slot: Slot;
  player?: SquadPlayer;
  active: boolean;
  dragging: boolean;
  dropTarget: boolean;
  onClick: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  const traitCount = player?.newTraits?.length ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className={`group absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center select-none transition ${
        dragging
          ? "z-40 scale-105 cursor-grabbing opacity-90"
          : dropTarget
            ? "z-30 scale-105"
            : active
              ? "scale-105"
              : "hover:scale-105"
      } ${player ? "cursor-grab" : "cursor-pointer"}`}
      style={{
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        touchAction: player ? "none" : "auto",
      }}
      aria-label={player ? `${player.name} 위치 이동 또는 선택` : `${slot.label} 선수 선택`}
    >
      {player ? (
        <div className="relative w-[74px] sm:w-[92px]">
          <div
            className={`relative h-[78px] overflow-hidden rounded-2xl border bg-black/35 shadow-xl transition sm:h-[96px] ${
              dragging
                ? "border-lime-300/70"
                : dropTarget
                  ? "border-lime-300 ring-2 ring-lime-300/35"
                  : "border-white/20"
            }`}
          >
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
            {traitCount > 0 && (
              <p className="mt-0.5 truncate text-[8px] font-bold text-cyan-200 sm:text-[9px]">
                신규특성 {traitCount}
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed bg-black/25 text-xl font-light shadow-lg transition sm:h-14 sm:w-14 ${
              dropTarget
                ? "border-lime-300 bg-lime-300/10 text-lime-100 ring-2 ring-lime-300/35"
                : "border-white/45 text-white/80"
            }`}
          >
            +
          </div>
          <span
            className={`mt-1 rounded-md px-2 py-0.5 text-[10px] font-black sm:text-xs ${
              dropTarget
                ? "bg-lime-300/15 text-lime-100 ring-1 ring-lime-300/30"
                : "bg-black/55 text-white"
            }`}
          >
            {slot.label}
          </span>
        </>
      )}
    </button>
  );
}

function TraitChips({ traits, compactMode = false }: { traits: string[]; compactMode?: boolean }) {
  if (traits.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${compactMode ? "mt-1.5" : "mt-3"}`}>
      {traits.map((trait) => (
        <span
          key={trait}
          className={`rounded-md border border-cyan-400/25 bg-cyan-400/10 font-bold text-cyan-200 ${
            compactMode ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[11px]"
          }`}
        >
          {trait}
        </span>
      ))}
    </div>
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
        <div className="mt-5 rounded-2xl border border-lime-400/20 bg-lime-400/5 p-3">
          <div className="flex items-center gap-3">
            {currentPlayer.seasonImg && (
              <img
                src={currentPlayer.seasonImg}
                alt={currentPlayer.seasonName}
                className="h-8 w-10 object-contain"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{currentPlayer.name}</p>
              <p className="text-xs text-gray-500">
                {currentPlayer.seasonName} · OVR {currentPlayer.ovr ?? "-"}
              </p>
            </div>
            <button
              type="button"
              onClick={onRemove}
              className="text-xs font-bold text-red-300 hover:text-red-200"
            >
              제거
            </button>
          </div>

          {(currentPlayer.newTraits?.length ?? 0) > 0 ? (
            <div className="mt-3 border-t border-white/[0.07] pt-3">
              <p className="text-[11px] font-bold text-cyan-200">고유 신규 특성</p>
              <TraitChips traits={currentPlayer.newTraits ?? []} />
            </div>
          ) : (
            <p className="mt-3 border-t border-white/[0.07] pt-3 text-[11px] text-gray-600">
              확인된 고유 신규 특성 없음
            </p>
          )}
        </div>
      )}

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-bold">강화 단계</p>
          <span
            className={`rounded-md border px-2 py-1 text-xs font-black ${getEnhancementBadgeTone(grade)}`}
          >
            +{grade}
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 13 }, (_, index) => index + 1).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => onGradeChange(level)}
              className={`rounded-lg border py-2 text-xs font-black transition ${getEnhancementBadgeTone(level)} ${
                grade === level
                  ? "ring-2 ring-white/60 opacity-100"
                  : "opacity-65 hover:opacity-100"
              }`}
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
        <p className="mt-2 text-[11px] text-gray-600">
          검색 결과는 기본 OVR 높은 순이며, 시즌별 고유 신규 특성도 함께 표시됩니다.
        </p>
      </div>

      <div className="mt-4 max-h-[48vh] space-y-2 overflow-y-auto pr-1 xl:max-h-[580px]">
        {loading && (
          <p className="py-8 text-center text-sm text-gray-500">선수 정보를 불러오는 중...</p>
        )}
        {!loading && error && (
          <p className="rounded-xl bg-red-400/5 p-4 text-sm text-red-300">{error}</p>
        )}
        {!loading && !error && query.trim() && results.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500">검색 결과가 없습니다.</p>
        )}
        {!loading &&
          !error &&
          results.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => onChoose(player)}
              className="flex w-full items-start gap-3 rounded-xl border border-white/[0.08] bg-black/10 p-3 text-left transition hover:border-lime-400/30 hover:bg-lime-400/[0.04]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
                {player.seasonImg ? (
                  <img
                    src={player.seasonImg}
                    alt={player.seasonName}
                    className="max-h-9 max-w-10 object-contain"
                  />
                ) : (
                  <span className="text-xs text-gray-700">-</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">{player.name}</p>
                <p className="mt-1 truncate text-xs text-gray-500">{player.seasonName}</p>
                {(player.newTraits?.length ?? 0) > 0 && (
                  <TraitChips traits={player.newTraits ?? []} compactMode />
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-black text-lime-300">{player.ovr ?? "-"}</p>
                <p className="text-[10px] font-bold text-gray-500">{player.position ?? "OVR"}</p>
              </div>
            </button>
          ))}
      </div>
    </div>
  );
}
