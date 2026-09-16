"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import PlayerArtwork from "@/components/PlayerArtwork";
import SquadPlayerCard from "@/components/SquadPlayerCard";
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
  artworkSpid?: number;
};

type SquadCardDetails = {
  salary: number | null;
  prices: Array<string | null>;
  positionOvr: number | null;
};

type PlayerVariant = SearchPlayer & {
  salary: number | null;
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
const SUMMARY_CARD_CACHE = new Map<string, SquadCardDetails>();

function isGoalkeeperSlot(label: string) {
  return label === "GK";
}

function isGoalkeeperPlayer(player: SearchPlayer | SquadPlayer) {
  return player.position === "GK";
}

function addDecimalStrings(left: string, right: string) {
  const a = left.replace(/^0+(?=\d)/, "") || "0";
  const b = right.replace(/^0+(?=\d)/, "") || "0";
  let carry = 0;
  let result = "";
  let i = a.length - 1;
  let j = b.length - 1;

  while (i >= 0 || j >= 0 || carry) {
    const sum = (i >= 0 ? Number(a[i--]) : 0) + (j >= 0 ? Number(b[j--]) : 0) + carry;
    result = String(sum % 10) + result;
    carry = Math.floor(sum / 10);
  }
  return result.replace(/^0+(?=\d)/, "") || "0";
}

function formatSquadPrice(value: string) {
  const digits = value.replace(/^0+(?=\d)/, "") || "0";
  if (digits === "0") return "0";
  if (digits.length <= 8) return Number(digits).toLocaleString("ko-KR");

  const labels = ["", "만", "억", "조", "경", "해"];
  const padLength = Math.ceil(digits.length / 4) * 4;
  const groups = digits.padStart(padLength, "0").match(/.{4}/g) ?? [];
  const parts: string[] = [];
  groups.forEach((group, index) => {
    const amount = Number(group);
    if (!amount) return;
    const unitIndex = groups.length - index - 1;
    parts.push(`${amount.toLocaleString("ko-KR")}${labels[unitIndex] ?? ""}`);
  });
  return parts.slice(0, 2).join(" ");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function withTraitDefaults(player: SquadPlayer): SquadPlayer {
  return {
    ...player,
    newTraits: Array.isArray(player.newTraits) ? player.newTraits : [],
    artworkSpid: player.artworkSpid ?? player.id,
  };
}

function getPositionBadgeTone(label: string) {
  if (["ST", "CF", "LW", "RW"].includes(label)) {
    return "border-rose-300/50 bg-rose-500 text-white";
  }

  if (["GK"].includes(label)) {
    return "border-amber-200/50 bg-amber-500 text-black";
  }

  if (["LB", "CB", "RB", "LWB", "RWB"].includes(label)) {
    return "border-blue-300/50 bg-blue-500 text-white";
  }

  return "border-emerald-200/50 bg-emerald-500 text-white";
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
  const [cardDetails, setCardDetails] = useState<Record<string, SquadCardDetails>>({});

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
        const targetSlot = formation.slots.find((slot) => slot.slotId === selectedSlotId);
        const goalkeeperOnly = targetSlot ? isGoalkeeperSlot(targetSlot.label) : false;
        setResults(
          items
            .filter((player) =>
              goalkeeperOnly ? isGoalkeeperPlayer(player) : !isGoalkeeperPlayer(player)
            )
            .map((player) => ({
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
  }, [query, selectedSlotId, formationKey]);

  useEffect(() => {
    const controller = new AbortController();
    const entries = Object.entries(players);
    if (entries.length === 0) {
      setCardDetails({});
      return () => controller.abort();
    }

    void Promise.all(
      entries.map(async ([slotId, player]) => {
        const slot = formation.slots.find((item) => item.slotId === slotId);
        if (!slot) return [slotId, null] as const;
        const cacheKey = `${player.id}:${slot.label}`;
        const cached = SUMMARY_CARD_CACHE.get(cacheKey);
        if (cached) return [slotId, cached] as const;

        try {
          const response = await fetch(
            `/api/squad/card?spid=${player.id}&name=${encodeURIComponent(player.name)}&position=${encodeURIComponent(slot.label)}`,
            { signal: controller.signal }
          );
          if (!response.ok) return [slotId, null] as const;
          const data = await response.json();
          const details: SquadCardDetails = {
            salary: Number.isFinite(data.salary) ? data.salary : null,
            prices: Array.isArray(data.prices) ? data.prices : [],
            positionOvr: Number.isFinite(data.positionOvr) ? data.positionOvr : null,
          };
          SUMMARY_CARD_CACHE.set(cacheKey, details);
          return [slotId, details] as const;
        } catch {
          return [slotId, null] as const;
        }
      })
    ).then((items) => {
      if (controller.signal.aborted) return;
      setCardDetails(
        Object.fromEntries(items.filter((item): item is readonly [string, SquadCardDetails] => item[1] !== null))
      );
    });

    return () => controller.abort();
  }, [players, formationKey]);

  const selectedPlayers = Object.values(players) as SquadPlayer[];
  const totalSalary = Object.entries(players).reduce(
    (sum, [slotId]) => sum + (cardDetails[slotId]?.salary ?? 0),
    0
  );
  const totalPrice = Object.entries(players).reduce((sum, [slotId, player]) => {
    const price = cardDetails[slotId]?.prices?.[player.grade - 1];
    return price && /^\d+$/.test(price) ? addDecimalStrings(sum, price) : sum;
  }, "0");

  const averageOvr = useMemo(() => {
    const ovrs = Object.entries(players)
      .map(([slotId, player]) => {
        const officialSlotOvr = cardDetails[slotId]?.positionOvr;
        if (officialSlotOvr !== null && officialSlotOvr !== undefined) {
          return officialSlotOvr;
        }

        const slot = formation.slots.find((item) => item.slotId === slotId);
        return slot?.label === player.position ? player.ovr : null;
      })
      .filter((value): value is number => value !== null);

    if (ovrs.length === 0) return null;
    return Math.round((ovrs.reduce((sum, value) => sum + value, 0) / ovrs.length) * 10) / 10;
  }, [players, cardDetails, formation.slots]);

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
    if (!selectedSlotId || !selectedSlot) return;
    if (isGoalkeeperSlot(selectedSlot.label) !== isGoalkeeperPlayer(player)) return;

    setPlayers((current) => ({
      ...current,
      [selectedSlotId]: {
        ...player,
        newTraits: player.newTraits ?? [],
        grade,
        artworkSpid: player.id,
      },
    }));

    closePanel();
  }

  function changeCurrentSeason(variant: PlayerVariant) {
    if (!selectedSlotId || !selectedSlot) return;
    if (isGoalkeeperSlot(selectedSlot.label) !== isGoalkeeperPlayer(variant)) return;

    setPlayers((current) => {
      const previous = current[selectedSlotId];
      if (!previous) return current;
      return {
        ...current,
        [selectedSlotId]: {
          id: variant.id,
          name: variant.name,
          seasonName: variant.seasonName,
          seasonImg: variant.seasonImg,
          ovr: variant.ovr,
          position: variant.position,
          newTraits: variant.newTraits ?? [],
          grade: previous.grade,
          artworkSpid: variant.id,
        },
      };
    });
  }

  function changeCurrentArtwork(spid: number) {
    if (!selectedSlotId) return;
    setPlayers((current) => {
      const player = current[selectedSlotId];
      if (!player) return current;
      return { ...current, [selectedSlotId]: { ...player, artworkSpid: spid } };
    });
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

  function handleFormationChange(nextFormation: string) {
    setFormationKey(nextFormation);
    closePanel();
  }

  function findDropTarget(clientX: number, clientY: number, rect: DOMRect, sourceSlotId?: string): Slot | null {
    const hitboxWidth = clamp(rect.width * 0.24, 88, 170);
    const hitboxHeight = clamp(rect.height * 0.14, 72, 118);
    let best: { slot: Slot; distance: number } | null = null;
    const sourceSlot = sourceSlotId
      ? formation.slots.find((slot) => slot.slotId === sourceSlotId) ?? null
      : null;

    for (const slot of formation.slots) {
      if (sourceSlot && isGoalkeeperSlot(sourceSlot.label) !== isGoalkeeperSlot(slot.label)) continue;
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

    const target = findDropTarget(event.clientX, event.clientY, rect, slotId);
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
          ? findDropTarget(drag.latestClientX, drag.latestClientY, rect, slotId)
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
      onSeasonChange={changeCurrentSeason}
      onArtworkChange={changeCurrentArtwork}
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
    <div className="mt-0 md:mt-8">
      <div className="border-b border-white/10 bg-[#111318] px-2 py-2 md:hidden">
        <div className="grid grid-cols-[42px_minmax(0,1fr)] gap-2">
          <div className="flex h-10 items-center justify-center rounded-lg border border-lime-400/25 bg-lime-400/[0.06] text-[12px] font-black tracking-tight text-white">
            FC<span className="text-lime-400">H</span>
          </div>
          <label className="flex h-10 items-center rounded-lg border border-white/15 bg-[#202522] px-3">
            <span className="sr-only">포메이션</span>
            <select
              value={formationKey}
              onChange={(event) => handleFormationChange(event.target.value)}
              className="h-full w-full bg-transparent text-[14px] font-black text-white outline-none"
            >
              {Object.keys(FORMATIONS).map((key) => (
                <option key={key} value={key} className="bg-[#181b21]">
                  {key}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={clearSquad}
          className="mt-1.5 h-9 w-full rounded-lg border border-red-400/20 bg-[#202522] px-3 text-[11px] font-bold text-red-300 active:bg-red-400/10"
        >
          전체 초기화
        </button>
      </div>

      <div className="hidden flex-col gap-4 rounded-2xl border border-white/10 bg-[#181b21] p-5 md:flex lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2 md:gap-3">
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
          <SummaryBadge label="총 급여" value={`${totalSalary}/310`} />
          <SummaryBadge label="총 가격" value={formatSquadPrice(totalPrice)} />
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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

      <div className="mt-1 grid gap-6 md:mt-4 xl:grid-cols-[minmax(0,760px)_410px] xl:justify-center">
        <div className="overflow-hidden border-y border-white/10 bg-[#101b14] p-0.5 md:rounded-3xl md:border md:p-5">
          <div
            ref={pitchRef}
            className="relative mx-auto aspect-[0.7] w-full max-w-[600px] overflow-hidden rounded-lg border border-white/25 bg-[repeating-linear-gradient(180deg,#17612d_0%,#17612d_16.66%,#135526_16.66%,#135526_33.33%)] shadow-inner shadow-black/40 md:rounded-2xl md:border-2"
          >
            <PitchLines />

            <div className="pointer-events-none absolute left-2 top-2 z-40 rounded-lg bg-black/60 px-2 py-1 backdrop-blur sm:left-3 sm:top-3 sm:rounded-xl sm:px-3 sm:py-2">
              <span className="text-[9px] text-gray-300 sm:text-xs">가치 </span>
              <span className="text-[12px] font-black text-white sm:text-base">{formatSquadPrice(totalPrice)}</span>
            </div>
            <div className="pointer-events-none absolute right-2 top-2 z-40 rounded-lg bg-black/60 px-2 py-1 text-right backdrop-blur sm:right-3 sm:top-3 sm:rounded-xl sm:px-3 sm:py-2">
              <span className="text-[9px] text-gray-300 sm:text-xs">급여 </span>
              <span className="text-[12px] font-black text-white sm:text-base">{totalSalary}</span>
              <span className="text-[9px] text-gray-300 sm:text-xs">/310</span>
            </div>

            {formation.slots.map((slot) => (
              <PositionHitbox
                key={`hitbox-${slot.slotId}`}
                slot={slot}
                dragActive={draggingSlotId !== null}
                active={draggingSlotId !== null && slot.slotId === dropTargetSlotId}
                occupied={Boolean(players[slot.slotId])}
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

            {formation.slots.map((slot) =>
              players[slot.slotId] ? null : (
                <PositionBadge
                  key={`badge-${slot.slotId}`}
                  slot={slot}
                  active={draggingSlotId !== null && slot.slotId === dropTargetSlotId}
                />
              )
            )}
          </div>
        </div>

        <aside className="hidden xl:block">{panel}</aside>
      </div>

      {selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 xl:hidden">
          <div className="max-h-[92vh] w-full max-w-[540px] overflow-y-auto">{panel}</div>
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
    <div className="pointer-events-none absolute inset-3 opacity-70 sm:inset-5">
      <div className="absolute inset-0 rounded-sm border-2 border-white/45" />
      <div className="absolute left-0 right-0 top-1/2 border-t-2 border-white/45" />
      <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/45 sm:h-28 sm:w-28" />
      <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/60" />
      <div className="absolute left-1/2 top-0 h-[16%] w-[56%] -translate-x-1/2 border-x-2 border-b-2 border-white/45" />
      <div className="absolute bottom-0 left-1/2 h-[16%] w-[56%] -translate-x-1/2 border-x-2 border-t-2 border-white/45" />
      <div className="absolute left-1/2 top-0 h-[7%] w-[27%] -translate-x-1/2 border-x-2 border-b-2 border-white/45" />
      <div className="absolute bottom-0 left-1/2 h-[7%] w-[27%] -translate-x-1/2 border-x-2 border-t-2 border-white/45" />
    </div>
  );
}

function PositionHitbox({
  slot,
  dragActive,
  active,
  occupied,
}: {
  slot: Slot;
  dragActive: boolean;
  active: boolean;
  occupied: boolean;
}) {
  return (
    <div
      className={`pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border transition-all duration-150 ${
        active
          ? "scale-105 border-lime-200 bg-lime-300/25 shadow-[0_0_28px_rgba(190,242,100,0.35)]"
          : dragActive
            ? "border-white/45 bg-black/35"
            : occupied
              ? "border-white/10 bg-black/10"
              : "border-white/[0.08] bg-black/35"
      }`}
      style={{
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        width: dragActive ? "clamp(88px, 24%, 170px)" : "clamp(48px, 15%, 86px)",
        height: dragActive ? "clamp(72px, 14%, 118px)" : "clamp(48px, 10%, 76px)",
      }}
      aria-hidden="true"
    >
      {dragActive && !occupied && (
        <span className="text-lg font-light text-white/65 sm:text-2xl">+</span>
      )}
    </div>
  );
}

function PositionBadge({ slot, active }: { slot: Slot; active: boolean }) {
  return (
    <span
      className={`pointer-events-none absolute z-50 -translate-x-1/2 rounded border px-1.5 py-0.5 text-[8px] font-black leading-none shadow-md transition sm:text-[10px] ${getPositionBadgeTone(
        slot.label
      )} ${active ? "scale-110 ring-2 ring-lime-100/80" : ""}`}
      style={{
        left: `${slot.x}%`,
        top: `calc(${slot.y}% - clamp(25px, 5%, 38px))`,
      }}
      aria-hidden="true"
    >
      {slot.label}
    </span>
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
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onDragStart={(event) => event.preventDefault()}
      className={`group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center select-none transition ${
        dragging
          ? "z-40 scale-105 cursor-grabbing opacity-90"
          : dropTarget
            ? "z-30 scale-105"
            : active
              ? "z-30 scale-105"
              : player
                ? "z-20 hover:scale-105"
                : "z-30 hover:scale-105"
      } ${player ? "cursor-grab" : "cursor-pointer"}`}
      style={{
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        touchAction: player ? "none" : "auto",
      }}
      aria-label={player ? `${player.name} 위치 이동 또는 선택` : `${slot.label} 선수 선택`}
    >
      {player ? (
        <SquadPlayerCard
          spid={player.id}
          artworkSpid={player.artworkSpid}
          name={player.name}
          seasonName={player.seasonName}
          seasonImg={player.seasonImg}
          primaryPosition={player.position}
          baseOvr={player.ovr}
          slotPosition={slot.label}
          grade={player.grade}
          newTraits={player.newTraits ?? []}
          dragging={dragging}
          dropTarget={dropTarget}
        />
      ) : (
        <div
          className={`flex h-[48px] w-[60px] items-center justify-center rounded-lg border bg-black/40 shadow-lg backdrop-blur-sm transition sm:h-[70px] sm:w-[88px] sm:rounded-xl ${
            active
              ? "border-lime-300/80 bg-lime-300/10 ring-2 ring-lime-300/30"
              : dropTarget
                ? "border-lime-300/80 bg-lime-300/10"
                : "border-white/20 hover:border-white/40 hover:bg-black/50"
          }`}
        >
          <span className="text-2xl font-light leading-none text-white/90 sm:text-4xl">+</span>
        </div>
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
  onSeasonChange,
  onArtworkChange,
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
  onSeasonChange: (variant: PlayerVariant) => void;
  onArtworkChange: (spid: number) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [replaceMode, setReplaceMode] = useState(!currentPlayer);
  const [variants, setVariants] = useState<PlayerVariant[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);

  useEffect(() => {
    setReplaceMode(!currentPlayer);
    if (!currentPlayer) {
      setVariants([]);
      return;
    }

    const controller = new AbortController();
    setVariantsLoading(true);
    fetch(`/api/squad/variants?spid=${currentPlayer.id}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return { variants: [] };
        return response.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const items = Array.isArray(data.variants) ? (data.variants as PlayerVariant[]) : [];
        const goalkeeperSlot = isGoalkeeperSlot(slot.label);
        setVariants(
          items.filter((variant) =>
            goalkeeperSlot ? isGoalkeeperPlayer(variant) : !isGoalkeeperPlayer(variant)
          )
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setVariants([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setVariantsLoading(false);
      });

    return () => controller.abort();
  }, [currentPlayer?.id, slot.label]);

  const currentVariant = currentPlayer
    ? variants.find((variant) => variant.id === currentPlayer.id) ?? null
    : null;
  const currentSalary = currentVariant?.salary ?? null;

  function salaryDiff(variant: PlayerVariant) {
    if (variant.salary == null || currentSalary == null) return "-";
    const diff = variant.salary - currentSalary;
    return diff > 0 ? `+${diff}` : String(diff);
  }

  return (
    <div className="rounded-3xl border border-white/15 bg-[#151a18] p-5 shadow-2xl sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold text-lime-400">{slot.label}</p>
          <h2 className="truncate text-2xl font-black">
            {currentPlayer ? currentPlayer.name : "선수 선택"}
          </h2>
        </div>
        <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-2xl text-gray-300 hover:bg-white/10 hover:text-white">×</button>
      </div>

      <section className="mt-5">
        <p className="mb-3 text-sm font-bold text-gray-300">강화</p>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 13 }, (_, index) => index + 1).map((level) => (
            <button key={level} type="button" onClick={() => onGradeChange(level)} className={`rounded-md border py-2 text-sm font-black transition ${getEnhancementBadgeTone(level)} ${grade === level ? "ring-2 ring-lime-300" : "opacity-75 hover:opacity-100"}`}>
              {level}
            </button>
          ))}
        </div>
      </section>

      {currentPlayer && (
        <>
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-300">다른 시즌</p>
              {variantsLoading && <span className="text-[10px] text-gray-500">불러오는 중...</span>}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {variants.map((variant) => (
                <button key={variant.id} type="button" onClick={() => onSeasonChange(variant)} className={`min-w-[66px] rounded-xl border p-2 text-center transition ${variant.id === currentPlayer.id ? "border-lime-300 bg-lime-300/10" : "border-white/10 bg-black/20 hover:border-white/30"}`}>
                  <div className="flex h-10 items-center justify-center">
                    {variant.seasonImg ? <img src={variant.seasonImg} alt={variant.seasonName} className="max-h-9 max-w-12 object-contain" /> : <span className="text-xs text-gray-600">-</span>}
                  </div>
                  <p className={`mt-1 text-xs font-black ${salaryDiff(variant).startsWith("+") ? "text-rose-300" : salaryDiff(variant).startsWith("-") && salaryDiff(variant) !== "-" ? "text-sky-300" : "text-gray-300"}`}>
                    {salaryDiff(variant)}
                  </p>
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-gray-500">숫자는 현재 선택된 시즌 대비 급여 차이입니다.</p>
          </section>

          <section className="mt-6">
            <p className="mb-3 text-sm font-bold text-gray-300">이미지</p>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {variants.map((variant) => {
                const selected = (currentPlayer.artworkSpid ?? currentPlayer.id) === variant.id;
                return (
                  <button key={`art-${variant.id}`} type="button" onClick={() => onArtworkChange(variant.id)} className={`relative h-[92px] min-w-[88px] overflow-hidden rounded-2xl border bg-white/[0.03] transition ${selected ? "border-lime-300 ring-2 ring-lime-300/25" : "border-white/10 hover:border-white/30"}`} title={`${variant.seasonName} 액션샷 사용`}>
                    <PlayerArtwork spid={variant.id} alt={`${currentPlayer.name} ${variant.seasonName}`} className="absolute bottom-0 left-1/2 max-h-[88px] max-w-[135%] -translate-x-1/2 object-contain" />
                    {variant.seasonImg && <img src={variant.seasonImg} alt={variant.seasonName} className="absolute bottom-1 right-1 z-10 h-5 max-w-7 object-contain" />}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="mt-6 grid grid-cols-3 gap-2">
            <a href={`/players/${currentPlayer.id}`} className="flex items-center justify-center rounded-xl border border-white/15 py-3 text-sm font-bold text-gray-200 hover:bg-white/5">상세</a>
            <button type="button" onClick={() => setReplaceMode((value) => !value)} className="rounded-xl border border-white/15 py-3 text-sm font-bold text-gray-200 hover:bg-white/5">교체</button>
            <button type="button" onClick={onRemove} className="rounded-xl border border-red-400/30 py-3 text-sm font-bold text-red-300 hover:bg-red-400/5">제거</button>
          </div>
        </>
      )}

      {(!currentPlayer || replaceMode) && (
        <section className="mt-6 border-t border-white/10 pt-5">
          <p className="mb-2 text-sm font-bold">{currentPlayer ? "선수 교체" : "선수 검색"}</p>
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={slot.label === "GK" ? "골키퍼 이름 검색" : "선수 이름 검색"} autoFocus={!currentPlayer} className="w-full rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-lime-400/50" />
          <div className="mt-4 max-h-[38vh] space-y-2 overflow-y-auto pr-1">
            {loading && <p className="py-8 text-center text-sm text-gray-500">선수 정보를 불러오는 중...</p>}
            {!loading && error && <p className="rounded-xl bg-red-400/5 p-4 text-sm text-red-300">{error}</p>}
            {!loading && !error && query.trim() && results.length === 0 && <p className="py-8 text-center text-sm text-gray-500">검색 결과가 없습니다.</p>}
            {!loading && !error && results.map((player) => (
              <button key={player.id} type="button" onClick={() => onChoose(player)} className="flex w-full items-start gap-3 rounded-xl border border-white/[0.08] bg-black/10 p-3 text-left transition hover:border-lime-400/30 hover:bg-lime-400/[0.04]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
                  {player.seasonImg ? <img src={player.seasonImg} alt={player.seasonName} className="max-h-9 max-w-10 object-contain" /> : <span className="text-xs text-gray-700">-</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{player.name}</p>
                  <p className="mt-1 truncate text-xs text-gray-500">{player.seasonName}</p>
                  {(player.newTraits?.length ?? 0) > 0 && <TraitChips traits={player.newTraits ?? []} compactMode />}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-black text-lime-300">{player.ovr ?? "-"}</p>
                  <p className="text-[10px] font-bold text-gray-500">{player.position ?? "OVR"}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
