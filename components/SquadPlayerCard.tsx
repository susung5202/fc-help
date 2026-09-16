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
  const traitLabel = newTraits.length > 0 ? `신규특성 ${newTraits.length}` : "신규특성 -";

  return (
    <div className="relative w-[82px] sm:w-[104px]">
      <div
        className={`relative h-[104px] overflow-hidden rounded-xl border bg-[linear-gradient(180deg,rgba(12,18,15,0.72),rgba(7,11,9,0.88))] shadow-xl backdrop-blur transition sm:h-[126px] ${
          dragging
            ? "border-lime-300/80 ring-2 ring-lime-300/25"
            : dropTarget
              ? "border-lime-300/90 ring-2 ring-lime-300/35"
              : "border-white/15"
        }`}
      >
        <div className="absolute left-1 top-1 z-30 flex max-w-[45px] flex-col items-start gap-0.5 sm:left-1.5 sm:top-1.5 sm:max-w-[56px] sm:gap-1">
          <span
            title={newTraits.length > 0 ? newTraits.join(", ") : "확인된 신규특성 없음"}
            className="max-w-full truncate rounded bg-cyan-400/15 px-1 py-0.5 text-[6px] font-black text-cyan-100 ring-1 ring-cyan-300/25 sm:text-[7px]"
          >
            {traitLabel}
          </span>
          <span className="rounded bg-emerald-500 px-1 py-0.5 text-[7px] font-black leading-none text-white shadow sm:text-[9px]">
            {slotPosition}
          </span>
          <span className="text-[14px] font-black leading-none text-white drop-shadow sm:text-[18px]">
            {enhancedOvr ?? "-"}
          </span>
        </div>

        <div className="absolute right-1 top-1 z-30 flex flex-col items-end gap-0.5 sm:right-1.5 sm:top-1.5 sm:gap-1">
          <span
            className={`rounded border px-1 py-0.5 text-[7px] font-black sm:text-[9px] ${getEnhancementBadgeTone(grade)}`}
          >
            +{grade}
          </span>
          <span className="rounded bg-black/65 px-1 py-0.5 text-[6px] font-bold text-amber-200 ring-1 ring-white/10 sm:text-[7px]">
            급여 {details?.salary ?? "-"}
          </span>
        </div>

        {seasonImg && (
          <img
            src={seasonImg}
            alt={seasonName}
            className="absolute bottom-[25px] left-1 z-30 h-4 max-w-7 object-contain drop-shadow sm:bottom-[31px] sm:left-1.5 sm:h-5 sm:max-w-9"
          />
        )}

        <PlayerArtwork
          key={spid}
          spid={spid}
          alt={name}
          className="absolute bottom-[22px] left-1/2 z-10 max-h-[78px] max-w-[132%] -translate-x-1/2 object-contain sm:bottom-[27px] sm:max-h-[98px]"
        />

        <div className="absolute inset-x-0 bottom-0 z-40 bg-black/80 px-1 py-1 text-center backdrop-blur sm:px-1.5 sm:py-1.5">
          <p className="truncate text-[8px] font-black leading-none text-white sm:text-[10px]">{name}</p>
          <p
            title={formatExactBp(selectedPrice)}
            className="mt-1 truncate text-[6px] font-bold leading-none text-lime-300 sm:text-[8px]"
          >
            {formatBp(selectedPrice)}
          </p>
        </div>
      </div>
    </div>
  );
}
