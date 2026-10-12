"use client";

import { useEffect, useMemo, useState } from "react";

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
      // 1) 해당 시즌의 액션샷
      `${CDN_BASE}/playersAction/p${numericSpid}.png`,
      // 2) 선수 공통 액션샷
      `${CDN_BASE}/playersAction/p${pid}.png`,
      // 3) 액션샷이 없으면 대갈미페(선수 고유 PID)를 우선 사용
      `${CDN_BASE}/players/p${pid}.png`,
      // 4) 마지막으로 시즌 SPID 헤드샷 시도
      `${CDN_BASE}/players/p${numericSpid}.png`,
    ].filter((src, index, array) => array.indexOf(src) === index);
  }, [spid]);

  const [sourceIndex, setSourceIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSourceIndex(0);
    setFailed(false);
  }, [spid]);

  const tryNextSource = () => {
    if (sourceIndex < sources.length - 1) {
      setSourceIndex(sourceIndex + 1);
    } else {
      setFailed(true);
    }
  };

  if (failed || sources.length === 0) return null;

  return (
    <img
      key={sources[sourceIndex]}
      src={sources[sourceIndex]}
      alt={alt}
      className={className}
      onLoad={(event) => {
        const image = event.currentTarget;

        // 일부 구시즌 이미지는 CDN이 HTTP 200으로 빈/극소 PNG를 반환한다.
        // 브라우저의 onError가 발생하지 않으므로 크기까지 확인해 fallback한다.
        if (image.naturalWidth <= 4 || image.naturalHeight <= 4) {
          tryNextSource();
        }
      }}
      onError={tryNextSource}
    />
  );
}
