"use client";

import { useMemo, useState } from "react";

type PlayerArtworkProps = {
  spid: number;
  alt: string;
  className?: string;
};

const CDN_BASE = "https://fco.dn.nexoncdn.co.kr/live/externalAssets/common";

export default function PlayerArtwork({
  spid,
  alt,
  className = "",
}: PlayerArtworkProps) {
  const sources = useMemo(() => {
    const numericSpid = Math.trunc(Number(spid));
    const pid = Math.abs(numericSpid) % 1_000_000;

    return [
      `${CDN_BASE}/playersAction/p${numericSpid}.png`,
      `${CDN_BASE}/playersAction/p${pid}.png`,
      `${CDN_BASE}/players/p${numericSpid}.png`,
      `${CDN_BASE}/players/p${pid}.png`,
    ].filter((src, index, array) => array.indexOf(src) === index);
  }, [spid]);

  const [sourceIndex, setSourceIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  if (failed || sources.length === 0) return null;

  return (
    <img
      src={sources[sourceIndex]}
      alt={alt}
      className={className}
      onError={() => {
        if (sourceIndex < sources.length - 1) {
          setSourceIndex((index) => index + 1);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}
