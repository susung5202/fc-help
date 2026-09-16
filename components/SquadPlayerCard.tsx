"use client";

import { useEffect, useMemo, useState } from "react";
import PlayerArtwork from "@/components/PlayerArtwork";
import { getEnhancementBadgeTone } from "@/lib/ui/enhancementBadge";

type CardDetails = {
  salary: number | null;
  prices: Array<string | null>;
  positionOvr: number | null;
  traitIcons: Record<string, string>;
};

type SquadPlayerCardProps = {
  spid: number;
  artworkSpid?: number;
  name: string;
  seasonName: string;
  seasonImg: string | null;
  primaryPosition: string | null;
  baseOvr: number | null;
  slotPosition: string;
  grade: number;
  calculatedOvr?: number | null;
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

const HEXAGON = "polygon(25% 6%, 75% 6%, 100% 50%, 75% 94%, 25% 94%, 0% 50%)";
const SOFT_SHADOW = "drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]";

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

  if (digits.length <= 4) {
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  if (digits.length <= 8) {
    return `${Math.floor(Number(digits) / 10_000).toLocaleString("ko-KR")}만`;
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

  return parts.slice(0, 2).join(" ");
}

function getPositionTone(position: string) {
  if (["ST", "CF", "LS", "RS", "LW", "RW", "LF", "RF"].includes(position)) {
    return "text-rose-400";
  }
  if (position === "GK") return "text-amber-300";
  if (["LB", "LCB", "CB", "RCB", "RB", "LWB", "RWB", "SW"].includes(position)) {
    return "text-blue-300";
  }
  return "text-emerald-300";
}

function TraitFallbackIcon() {
  return (
    <div
      className={`flex h-5 w-5 items-center justify-center bg-[#d8c994] text-[10px] font-black text-[#302c1d] sm:h-9 sm:w-9 sm:text-base ${SOFT_SHADOW}`}
      style={{ clipPath: HEXAGON }}
      aria-hidden="true"
    >
      ✦
    </div>
  );
}

function SalaryHex({ salary }: { salary: number | null | undefined }) {
  return (
    <div
      className={`relative flex h-5 w-5 items-center justify-center bg-white/85 sm:h-10 sm:w-10 ${SOFT_SHADOW}`}
      style={{ clipPath: HEXAGON }}
      title={salary == null ? "급여 정보 없음" : `급여 ${salary}`}
    >
      <div
        className="absolute inset-[2px] bg-[#111318]"
        style={{ clipPath: HEXAGON }}
      />
      <span className="relative z-10 text-[8px] font-black text-white sm:text-sm">
        {salary ?? "-"}
      </span>
    </div>
  );
}

export default function SquadPlayerCard({
  spid,
  artworkSpid,
  name,
  seasonName,
  seasonImg,
  primaryPosition,
  baseOvr,
  slotPosition,
  grade,
  calculatedOvr,
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
          traitIcons:
            data.traitIcons && typeof data.traitIcons === "object" ? data.traitIcons : {},
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
    calculatedOvr !== null && calculatedOvr !== undefined
      ? calculatedOvr
      : positionOvr === null
        ? null
        : positionOvr + (ENHANCEMENT_OVR_BONUS[grade] ?? 0) + 4;
  const selectedPrice = details?.prices?.[grade - 1] ?? null;
  const firstNewTrait = newTraits[0] ?? null;
  const firstTraitIcon = firstNewTrait ? details?.traitIcons?.[firstNewTrait] ?? null : null;
  const renderedArtworkSpid = artworkSpid ?? spid;

  return (
    <div
      className={`relative h-[94px] w-[64px] transition sm:h-[156px] sm:w-[116px] ${
        dragging || dropTarget ? "scale-105" : ""
      }`}
    >
      {(dragging || dropTarget) && (
        <div
          className={`pointer-events-none absolute inset-0 rounded-xl border-2 ${
            dragging ? "border-lime-300/80" : "border-cyan-300/80"
          }`}
        />
      )}

      {firstNewTrait && (
        <div className={`absolute left-[-8px] top-0 z-30 sm:left-[-10px] ${SOFT_SHADOW}`} title={newTraits.join(", ")}>
          {firstTraitIcon ? (
            <img
              src={firstTraitIcon}
              alt={firstNewTrait}
              className="h-5 w-5 object-contain sm:h-9 sm:w-9"
            />
          ) : (
            <TraitFallbackIcon />
          )}
          {newTraits.length > 1 && (
            <span className="absolute -bottom-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-300 px-1 text-[8px] font-black text-black sm:h-5 sm:min-w-5 sm:text-[9px]">
              {newTraits.length}
            </span>
          )}
        </div>
      )}

      <div className={`absolute left-[-8px] top-[21px] z-30 flex flex-col items-start sm:left-[-10px] sm:top-[39px] ${SOFT_SHADOW}`}>
        <span className={`text-[8px] font-black leading-none sm:text-base ${getPositionTone(slotPosition)}`}>
          {slotPosition}
        </span>
        <span className="mt-0.5 text-[14px] font-black leading-none text-white sm:text-[27px]">
          {enhancedOvr ?? "-"}
        </span>
      </div>

      {seasonImg && (
        <img
          src={seasonImg}
          alt={seasonName}
          className={`absolute bottom-[25px] left-[-8px] z-30 h-3.5 max-w-6 object-contain sm:bottom-[42px] sm:left-[-10px] sm:h-6 sm:max-w-10 ${SOFT_SHADOW}`}
        />
      )}

      <div className="absolute right-[-8px] top-[31px] z-30 sm:right-[-10px] sm:top-[46px]">
        <SalaryHex salary={details?.salary} />
      </div>

      <span
        className={`absolute bottom-[25px] right-[-8px] z-30 flex h-[15px] w-[22px] items-center justify-center rounded-[2px] border p-0 text-[8px] font-black leading-none sm:bottom-[42px] sm:right-[-10px] sm:h-6 sm:w-8 sm:border-2 sm:text-xs ${getEnhancementBadgeTone(grade)} ${SOFT_SHADOW}`}
        title={`${grade}강`}
      >
        {grade}
      </span>

      <PlayerArtwork
        key={renderedArtworkSpid}
        spid={renderedArtworkSpid}
        alt={name}
        className="pointer-events-none absolute bottom-[22px] left-1/2 z-10 max-h-[58px] max-w-[132%] -translate-x-1/2 object-contain sm:bottom-[39px] sm:max-h-[108px] sm:max-w-[140%]"
      />

      <div className={`absolute inset-x-[-5px] bottom-0 z-40 text-center sm:inset-x-[-10px] ${SOFT_SHADOW}`}>
        <p className="truncate text-[8px] font-black leading-none text-white sm:text-[14px]">
          {name}
        </p>
        <p
          title={formatExactBp(selectedPrice)}
          className="mt-0.5 truncate text-[7px] font-black leading-none text-amber-300 sm:mt-1.5 sm:text-[11px]"
        >
          {formatBp(selectedPrice)}
        </p>
      </div>
    </div>
  );
}
