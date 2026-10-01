"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PlayerArtwork from "@/components/PlayerArtwork";

type TeamColorItem = {
  id: number;
  name: string;
  category: "affiliation" | "feature";
  related: boolean;
  overlap?: number;
};

type TeamColorSeasonCard = {
  id: number;
  name: string;
  seasonName: string;
  seasonImg: string | null;
  ovr: number | null;
  position: string | null;
  newTraits: string[];
};

function findPlayerSearchInput() {
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement>(
      'input[placeholder="선수 이름 검색"], input[placeholder="골키퍼 이름 검색"]'
    )
  );

  return (
    inputs.find((input) => {
      const rect = input.getBoundingClientRect();
      const style = window.getComputedStyle(input);
      return (
        input.isConnected &&
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden"
      );
    }) ?? null
  );
}

function compactQuery(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, "").trim();
}

export default function SquadTeamColorSearch() {
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const [playerInput, setPlayerInput] = useState<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [teamColors, setTeamColors] = useState<TeamColorItem[]>([]);
  const [selectedTeamColor, setSelectedTeamColor] = useState<TeamColorItem | null>(null);
  const [players, setPlayers] = useState<TeamColorSeasonCard[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loadingColors, setLoadingColors] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [colorError, setColorError] = useState("");
  const [playerError, setPlayerError] = useState("");

  useEffect(() => {
    let currentMount: HTMLElement | null = null;
    let currentInput: HTMLInputElement | null = null;

    const sync = () => {
      const input = findPlayerSearchInput();
      if (input === currentInput && currentMount?.isConnected) return;

      if (currentMount?.isConnected) currentMount.remove();
      currentMount = null;
      currentInput = input;

      if (!input || !input.parentElement) {
        setMountNode(null);
        setPlayerInput(null);
        return;
      }

      const mount = document.createElement("div");
      mount.dataset.teamColorSearchMount = "true";
      input.insertAdjacentElement("afterend", mount);
      currentMount = mount;
      setMountNode(mount);
      setPlayerInput(input);
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    window.addEventListener("resize", sync);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
      if (currentMount?.isConnected) currentMount.remove();
    };
  }, []);

  const normalizedQuery = query.trim();
  const compactedQuery = compactQuery(query);

  useEffect(() => {
    if (!mountNode || selectedTeamColor || compactedQuery.length < 2) {
      if (compactedQuery.length < 2) {
        setTeamColors([]);
        setColorError("");
      }
      setLoadingColors(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingColors(true);
      setColorError("");
      try {
        const response = await fetch(
          `/api/squad/team-color-search?q=${encodeURIComponent(normalizedQuery)}`,
          { signal: controller.signal }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "팀컬러 검색 실패");
        setTeamColors(Array.isArray(data.teamColors) ? data.teamColors : []);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setColorError(
          requestError instanceof Error ? requestError.message : "팀컬러 검색에 실패했습니다."
        );
        setTeamColors([]);
      } finally {
        if (!controller.signal.aborted) setLoadingColors(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [mountNode, normalizedQuery, compactedQuery, selectedTeamColor]);

  const goalkeeperOnly = playerInput?.placeholder === "골키퍼 이름 검색";

  useEffect(() => {
    if (!mountNode || !selectedTeamColor) {
      setPlayers([]);
      setHasNext(false);
      setLoadingPlayers(false);
      setPlayerError("");
      return;
    }

    const controller = new AbortController();
    setLoadingPlayers(true);
    setPlayerError("");
    setPlayers([]);

    const params = new URLSearchParams({
      teamColorId: String(selectedTeamColor.id),
      page: String(page),
      target: goalkeeperOnly ? "gk" : "field",
    });

    void fetch(`/api/squad/team-color-search?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "팀컬러 선수 조회 실패");
        return data;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setPlayers(Array.isArray(data.players) ? data.players : []);
        setHasNext(Boolean(data.hasNext));
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        setPlayerError(
          requestError instanceof Error
            ? requestError.message
            : "팀컬러 적용 시즌카드를 불러오지 못했습니다."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPlayers(false);
      });

    return () => controller.abort();
  }, [mountNode, selectedTeamColor, page, goalkeeperOnly]);

  function resetSelection(nextQuery = query) {
    setSelectedTeamColor(null);
    setPlayers([]);
    setHasNext(false);
    setPage(1);
    setPlayerError("");
    setTeamColors([]);
    setQuery(nextQuery);
  }

  function selectSeasonCard(player: TeamColorSeasonCard) {
    window.dispatchEvent(
      new CustomEvent("fc-help:squad-select-player", {
        detail: {
          id: player.id,
          name: player.name,
          seasonName: player.seasonName,
          seasonImg: player.seasonImg,
          ovr: player.ovr,
          position: player.position,
          newTraits: Array.isArray(player.newTraits) ? player.newTraits : [],
        },
      })
    );
  }

  if (!mountNode) return null;

  return createPortal(
    <div className="mt-2 rounded-xl border border-white/10 bg-black/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black text-lime-300">팀컬러 검색</p>
          <p className="mt-0.5 text-[9px] leading-4 text-gray-500">
            띄어쓰기와 상관없이 팀컬러를 검색하고, 선택한 팀컬러의 시즌카드를 바로 고를 수 있습니다.
          </p>
        </div>
        {(query || selectedTeamColor) && (
          <button
            type="button"
            onClick={() => resetSelection("")}
            className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-[9px] font-bold text-gray-400 hover:bg-white/5 hover:text-white"
          >
            초기화
          </button>
        )}
      </div>

      {!selectedTeamColor ? (
        <>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setTeamColors([]);
              setColorError("");
            }}
            placeholder="예: 레알마드리드, 프랑스, 벨기에"
            className="mt-2.5 w-full rounded-lg border border-white/10 bg-[#0f1115] px-3 py-2.5 text-xs font-bold text-white outline-none placeholder:font-medium placeholder:text-gray-600 focus:border-lime-400/50"
          />

          {compactedQuery.length > 0 && compactedQuery.length < 2 && (
            <p className="mt-2 text-[10px] text-gray-500">팀컬러 이름을 2글자 이상 입력하세요.</p>
          )}
          {loadingColors && (
            <p className="mt-3 py-3 text-center text-[10px] font-bold text-gray-500">
              팀컬러를 찾는 중...
            </p>
          )}
          {!loadingColors && colorError && (
            <p className="mt-3 rounded-lg bg-red-400/5 px-3 py-2 text-[10px] font-bold text-red-300">
              {colorError}
            </p>
          )}
          {!loadingColors &&
            !colorError &&
            compactedQuery.length >= 2 &&
            teamColors.length === 0 && (
              <p className="mt-3 py-3 text-center text-[10px] text-gray-500">
                검색되는 팀컬러가 없습니다.
              </p>
            )}

          {!loadingColors && !colorError && teamColors.length > 0 && (
            <div className="mt-3 max-h-60 overflow-y-auto rounded-lg border border-white/[0.07] bg-[#0f1115]">
              {teamColors.map((teamColor) => (
                <button
                  key={teamColor.id}
                  type="button"
                  onClick={() => {
                    setPage(1);
                    setSelectedTeamColor(teamColor);
                  }}
                  className="flex w-full items-center gap-2 border-b border-white/[0.06] px-3 py-2.5 text-left last:border-b-0 hover:bg-lime-300/[0.04]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black text-gray-200">{teamColor.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[8px] font-black ${
                          teamColor.category === "affiliation"
                            ? "bg-cyan-300/10 text-cyan-200"
                            : "bg-violet-300/10 text-violet-200"
                        }`}
                      >
                        {teamColor.category === "affiliation" ? "소속" : "관계·특성"}
                      </span>
                      {teamColor.related && (
                        <span className="rounded bg-lime-300/10 px-1.5 py-0.5 text-[8px] font-black text-lime-200">
                          연관 팀컬러{teamColor.overlap ? ` · 공통 ${teamColor.overlap}명` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] font-black text-gray-600">선택 →</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mt-2.5 flex items-center gap-3 rounded-xl border border-lime-300/20 bg-lime-300/[0.04] px-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-lime-300 px-1.5 py-0.5 text-[8px] font-black text-black">
                  선택됨
                </span>
                <span className="text-[9px] font-bold text-gray-500">
                  {selectedTeamColor.category === "affiliation" ? "소속 팀컬러" : "관계·특성 팀컬러"}
                </span>
              </div>
              <p className="mt-1 truncate text-sm font-black text-white">{selectedTeamColor.name}</p>
            </div>
            <button
              type="button"
              onClick={() => resetSelection(query)}
              className="shrink-0 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[9px] font-black text-gray-300 hover:bg-white/[0.07]"
            >
              팀컬러 변경
            </button>
          </div>

          {loadingPlayers && (
            <p className="mt-3 py-5 text-center text-[10px] font-bold text-gray-500">
              시즌카드를 불러오는 중...
            </p>
          )}
          {!loadingPlayers && playerError && (
            <p className="mt-3 rounded-lg bg-red-400/5 px-3 py-2 text-[10px] font-bold text-red-300">
              {playerError}
            </p>
          )}
          {!loadingPlayers && !playerError && players.length === 0 && (
            <p className="mt-3 py-5 text-center text-[10px] text-gray-500">
              현재 포지션에 표시할 시즌카드가 없습니다.
            </p>
          )}

          {!loadingPlayers && !playerError && players.length > 0 && (
            <>
              <div className="mt-3 flex items-center justify-between text-[9px] font-bold text-gray-500">
                <span>시즌카드 {players.length}개 · {page}페이지</span>
                <span>{goalkeeperOnly ? "GK 시즌만" : "필드 선수 시즌"}</span>
              </div>
              <div className="mt-2 grid max-h-[420px] grid-cols-1 gap-1.5 overflow-y-auto rounded-lg border border-white/[0.07] bg-[#0f1115] p-1.5 sm:grid-cols-2">
                {players.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => selectSeasonCard(player)}
                    className="flex min-w-0 items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.015] px-2 py-2 text-left hover:border-lime-300/20 hover:bg-lime-300/[0.04]"
                  >
                    <div className="relative h-12 w-11 shrink-0 overflow-hidden rounded-lg bg-white/[0.04]">
                      <PlayerArtwork
                        spid={player.id}
                        alt={player.name}
                        className="absolute bottom-0 left-1/2 max-h-12 max-w-[135%] -translate-x-1/2 object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {player.seasonImg && (
                          <img
                            src={player.seasonImg}
                            alt={player.seasonName}
                            className="h-4 w-auto max-w-8 shrink-0 object-contain"
                          />
                        )}
                        <p className="truncate text-[11px] font-black text-gray-100">{player.name}</p>
                      </div>
                      <p className="mt-0.5 truncate text-[8px] font-bold text-gray-500">
                        {player.seasonName}
                      </p>
                      <p className="mt-0.5 text-[9px] font-black text-lime-300">
                        {player.position ?? "포지션 미확인"} · 이 시즌 선택
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-2 flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1 || loadingPlayers}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-black text-gray-300 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ← 이전
                </button>
                <span className="min-w-12 text-center text-[10px] font-black text-white">{page}</span>
                <button
                  type="button"
                  disabled={!hasNext || loadingPlayers}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-black text-gray-300 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  다음 →
                </button>
              </div>
              <p className="mt-2 text-[9px] leading-4 text-gray-600">
                한 페이지에 최대 30개 시즌카드를 표시합니다. 카드를 누르면 해당 시즌이 바로 스쿼드에 선택됩니다.
              </p>
            </>
          )}
        </>
      )}
    </div>,
    mountNode
  );
}
