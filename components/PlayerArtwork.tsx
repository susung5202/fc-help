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
      // 2) 액션샷이 없으면 같은 시즌의 얼굴 이미지(대갈미페)
      `${CDN_BASE}/players/p${numericSpid}.png`,
      // 3) 시즌 얼굴 이미지도 없으면 공통 선수 얼굴 이미지
      `${CDN_BASE}/players/p${pid}.png`,
      // 4) 마지막 수단으로 공통 액션샷
      `${CDN_BASE}/playersAction/p${pid}.png`,
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

        // CDN은 간혹 HTTP 200으로 빈/미지원 이미지 아이콘을 돌려준다.
        // 액션샷은 큰 이미지여야 하므로 64px 이하도 유효하지 않은 것으로 본다.
        // 얼굴 이미지는 작은 정사각형도 정상일 수 있어 4px 이하만 거른다.
        const minSize = sourceIndex === 0 || sourceIndex === 3 ? 64 : 4;
        if (image.naturalWidth <= minSize || image.naturalHeight <= minSize) {
          tryNextSource();
        }
      }}
      onError={tryNextSource}
    />
  );
}
