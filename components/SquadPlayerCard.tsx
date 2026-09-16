"use client";

import { useEffect, useMemo, useState } from "react";
import PlayerArtwork from "@/components/PlayerArtwork";
import { getEnhancementBadgeTone } from "@/lib/ui/enhancementBadge";

type CardDetails = {
  salary: number | null;
  prices: Array<string | null>;
  positionOvr: number | null;
};

type SquadPlayerCardProps = {
  spid: number;
  name: string;
  seasonName: string;
  seasonImg: string | null;
  primaryPosition: string | null;
  baseOvr: number | null;
  slotPosition: string;
  grade: number;
  newTraits: string[];
  dragging: boolean;
  dropTarget: boolean;
};

const CARD_CACHE = new Map<string, CardDetails>();

const ENHANCEMENT_OVR_BONUS: Record<number, number> = {
  1: 0,
  2: 1,
  3: 2,
  4: 4,
  5: 6,
  6: 8,
  7: 11,
  8: 15,
  9: 17,
  10: 19,
  11: 21,
  12: 24,
  13: 27,
};

function normalizeDigits(value: string | null | undefined) {
  if (!value || !/^\d+$/.test(value)) return null;
  return value.replace(/^0+(?=\d)/, "");
}

function formatExactBp(value: string | null | undefined) {
  const digits = normalizeDigits(value);
  if (!digits) return "시세 정보 없음";
  return `${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} BP`;
}

function formatBp(value: string | null | undefined) {
  const digits = normalizeDigits(value);
  if (!digits) return "시세 -";

  if (digits.length <= 8) {
    return `${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} BP`;
  }

  const labels = ["", "만", "억", "조", "경", "해"];
  const padLength = Math.ceil(digits.length / 4) * 4;
  const padded = digits.padStart(padLength, "0");
  const groups: string[] = [];

  for (let index = 0; index < padded.length; index += 4) {
    groups.push(padded.slice(index, index + 4));
  }

  const parts: string[] = [];
  groups.forEach((group, index) => {
    const amount = Number(group);
    if (amount === 0) return;
    const unitIndex = groups.length - index - 1;
    parts.push(`${amount.toLocaleString("ko-KR")}${labels[unitIndex] ?? ""}`);
  });

  return `${parts.slice(0, 2).join(" ")} BP`;
}

function getPositionTone(position: string) {
  if (["ST", "CF", "LS", "RS", "LW", "RW", "LF", "RF"].includes(position)) {
    return "text-rose-400";
  }
  if (["GK"].includes(position)) return "text-amber-300";
  if (["LB", "LCB", "CB", "RCB", "RB", "LWB", "RWB", "SW"].includes(position)) {
    return "text-blue-300";
  }
  return "text-emerald-300";
}

export default function SquadPlayerCard({
  spid,
  name,
  seasonName,
  seasonImg,
  primaryPosition,
  baseOvr,
  slotPosition,
  grade,
  newTraits,
  dragging,
  dropTarget,
}: SquadPlayerCardProps) {
  const cacheKey = `${spid}:${slotPosition}`;
  const [details, setDetails] = useState<CardDetails | null>(() => CARD_CACHE.get(cacheKey) ?? null);

  useEffect(() => {
    const cached = CARD_CACHE.get(cacheKey);
    if (cached) {
      setDetails(cached);
      return;
    }

    setDetails(null);
    const controller = new AbortController();

    fetch(
      `/api/squad/card?spid=${spid}&name=${encodeURIComponent(name)}&position=${encodeURIComponent(slotPosition)}`,
      { signal: controller.signal }
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("card data request failed");
        return (await response.json()) as CardDetails;
      })
      .then((data) => {
        const normalized: CardDetails = {
          salary: Number.isFinite(data.salary) ? data.salary : null,
          prices: Array.isArray(data.prices) ? data.prices : [],
          positionOvr: Number.isFinite(data.positionOvr) ? data.positionOvr : null,
        };
        CARD_CACHE.set(cacheKey, normalized);
        setDetails(normalized);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("Squad player card data failed", error);
      });

    return () => controller.abort();
  }, [cacheKey, name, slotPosition, spid]);

  const positionOvr = useMemo(() => {
    if (details?.positionOvr !== null && details?.positionOvr !== undefined) {
      return details.positionOvr;
    }
    if (primaryPosition === slotPosition) return baseOvr;
    return null;
  }, [baseOvr, details?.positionOvr, primaryPosition, slotPosition]);

  const enhancedOvr =
    positionOvr === null ? null : positionOvr + (ENHANCEMENT_OVR_BONUS[grade] ?? 0);
  const selectedPrice = details?.prices?.[grade - 1] ?? null;
  const traitTitle = newTraits.length > 0 ? newTraits.join(", ") : "확인된 신규특성 없음";

  return (
    <div
      className={`relative h-[132px] w-[92px] transition sm:h-[158px] sm:w-[116px] ${
        dragging ? "scale-105 opacity-90" : dropTarget ? "scale-105" : ""
      }`}
    >
      <div
        className={`pointer-events-none absolute inset-0 rounded-2xl transition ${
          dragging
            ? "bg-lime-300/10 ring-2 ring-lime-300/70"
            : dropTarget
              ? "bg-lime-300/10 ring-2 ring-lime-300/80"
              : ""
        }`}
      />

      <div className="absolute left-0 top-1 z-30 flex flex-col items-start gap-0.5 sm:top-2 sm:gap-1">
        <span
          title={traitTitle}
          className="relative flex h-5 w-5 items-center justify-center rounded border border-amber-200/70 bg-[#17170d]/90 text-[9px] font-black text-amber-200 shadow-md sm:h-6 sm:w-6 sm:text-[10px]"
        >
          특
          {newTraits.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-cyan-400 px-0.5 text-[7px] font-black text-black">
              {newTraits.length}
            </span>
          )}
        </span>
        <span className={`text-[12px] font-black leading-none drop-shadow sm:text-[15px] ${getPositionTone(slotPosition)}`}>
          {slotPosition}
        </span>
        <span className="text-[19px] font-black leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] sm:text-[24px]">
          {enhancedOvr ?? "-"}
        </span>
      </div>

      <div className="absolute right-0 top-1 z-30 flex flex-col items-end gap-1 sm:top-2">
        <span
          className={`min-w-7 rounded border px-1.5 py-1 text-center text-[11px] font-black shadow-lg sm:min-w-8 sm:text-[13px] ${getEnhancementBadgeTone(grade)}`}
        >
          +{grade}
        </span>
        <span
          className="flex h-7 min-w-8 items-center justify-center bg-black/85 px-1.5 text-[10px] font-black text-white shadow-lg ring-1 ring-white/20 sm:h-8 sm:min-w-9 sm:text-[12px]"
          style={{ clipPath: "polygon(50% 0, 95% 24%, 95% 76%, 50% 100%, 5% 76%, 5% 24%)" }}
          title="급여"
        >
          {details?.salary ?? "-"}
        </span>
      </div>

      <PlayerArtwork
        key={spid}
        spid={spid}
        alt={name}
        className="pointer-events-none absolute bottom-[34px] left-1/2 z-10 max-h-[96px] max-w-[142%] -translate-x-1/2 object-contain drop-shadow-[0_8px_8px_rgba(0,0,0,0.35)] sm:bottom-[41px] sm:max-h-[118px]"
      />

      {seasonImg && (
        <img
          src={seasonImg}
          alt={seasonName}
          className="pointer-events-none absolute bottom-[40px] left-0 z-30 h-5 max-w-8 object-contain drop-shadow-md sm:bottom-[49px] sm:h-6 sm:max-w-10"
        />
      )}

      <div className="absolute inset-x-[-4px] bottom-0 z-40 text-center sm:inset-x-[-8px]">
        <div className="bg-gradient-to-t from-black/85 via-black/65 to-transparent px-1 pb-1 pt-3">
          <p className="truncate text-[11px] font-black leading-tight text-white drop-shadow sm:text-[14px]">
            {name}
          </p>
          <p
            title={formatExactBp(selectedPrice)}
            className="mt-0.5 truncate text-[9px] font-black leading-tight text-amber-300 drop-shadow sm:text-[11px]"
          >
            {formatBp(selectedPrice)}
          </p>
        </div>
      </div>
    </div>
  );
}
