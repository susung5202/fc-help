"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import PlayerArtwork from "@/components/PlayerArtwork";

type TeamColorItem = {
  id: number;
  name: string;
  category: "affiliation" | "feature";
  related: boolean;
  overlap?: number;
};

type TeamColorPlayer = {
  name: string;
  sampleSpid: number;
  position: string | null;
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

function setReactInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  input.focus();
}

export default function SquadTeamColorSearch() {
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const [playerInput, setPlayerInput] = useState<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [teamColors, setTeamColors] = useState<TeamColorItem[]>([]);
  const [selectedTeamColor, setSelectedTeamColor] = useState<TeamColorItem | null>(null);
  const [players, setPlayers] = useState<TeamColorPlayer[]>([]);
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

  useEffect(() => {
    if (!mountNode || selectedTeamColor || normalizedQuery.length < 2) {
      if (normalizedQuery.length < 2) {
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
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [mountNode, normalizedQuery, selectedTeamColor]);

  useEffect(() => {
    if (!mountNode || !selectedTeamColor) {
      setPlayers([]);
      setLoadingPlayers(false);
      setPlayerError("");
      return;
    }

    const controller = new AbortController();
    setLoadingPlayers(true);
    setPlayerError("");
    setPlayers([]);

    void fetch(`/api/squad/team-color-search?teamColorId=${selectedTeamColor.id}`, {
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
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        setPlayerError(
          requestError instanceof Error
            ? requestError.message
            : "팀컬러 적용 선수를 불러오지 못했습니다."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPlayers(false);
      });

    return () => controller.abort();
  }, [mountNode, selectedTeamColor]);

  const goalkeeperOnly = playerInput?.placeholder === "골키퍼 이름 검색";
  const visiblePlayers = useMemo(
    () =>
      players.filter((player) =>
        goalkeeperOnly ? player.position === "GK" : player.position !== "GK"
      ),
    [players, goalkeeperOnly]
  );

  function resetSelection(nextQuery = query) {
    setSelectedTeamColor(null);
    setPlayers([]);
    setPlayerError("");
    setTeamColors([]);
    setQuery(nextQuery);
  }

  if (!mountNode) return null;

  return createPortal(
    <div className="mt-2 rounded-xl border border-white/10 bg-black/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black text-lime-300">팀컬러 검색</p>
          <p className="mt-0.5 text-[9px] leading-4 text-gray-500">
            팀컬러를 먼저 선택하면 그 팀컬러를 적용받는 선수를 보여줍니다.
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
            placeholder="예: 레알 마드리드, 바이에른 뮌헨, 대한민국"
            className="mt-2.5 w-full rounded-lg border border-white/10 bg-[#0f1115] px-3 py-2.5 text-xs font-bold text-white outline-none placeholder:font-medium placeholder:text-gray-600 focus:border-lime-400/50"
          />

          {normalizedQuery.length > 0 && normalizedQuery.length < 2 && (
            <p className="mt-2 text-[10px] text-gray-500">팀컬러 이름을 2글자 이상 입력하세요.</p>
          )}
          {loadingColors && (
            <p className="mt-3 py-3 text-center text-[10px] font-bold text-gray-500">
              공식 팀컬러와 연관 팀컬러를 찾는 중...
            </p>
          )}
          {!loadingColors && colorError && (
            <p className="mt-3 rounded-lg bg-red-400/5 px-3 py-2 text-[10px] font-bold text-red-300">
              {colorError}
            </p>
          )}
          {!loadingColors &&
            !colorError &&
            normalizedQuery.length >= 2 &&
            teamColors.length === 0 && (
              <p className="mt-3 py-3 text-center text-[10px] text-gray-500">
                검색되는 팀컬러가 없습니다.
              </p>
            )}

          {!loadingColors && !colorError && teamColors.length > 0 && (
            <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-white/[0.07] bg-[#0f1115]">
              {teamColors.map((teamColor) => (
                <button
                  key={teamColor.id}
                  type="button"
                  onClick={() => setSelectedTeamColor(teamColor)}
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
              적용 선수를 불러오는 중...
            </p>
          )}
          {!loadingPlayers && playerError && (
            <p className="mt-3 rounded-lg bg-red-400/5 px-3 py-2 text-[10px] font-bold text-red-300">
              {playerError}
            </p>
          )}
          {!loadingPlayers && !playerError && visiblePlayers.length === 0 && (
            <p className="mt-3 py-5 text-center text-[10px] text-gray-500">
              현재 포지션에 표시할 적용 선수가 없습니다.
            </p>
          )}

          {!loadingPlayers && !playerError && visiblePlayers.length > 0 && (
            <>
              <div className="mt-3 flex items-center justify-between text-[9px] font-bold text-gray-500">
                <span>적용 선수 {visiblePlayers.length}명</span>
                <span>{goalkeeperOnly ? "GK만 표시" : "필드 선수 표시"}</span>
              </div>
              <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-white/[0.07] bg-[#0f1115]">
                {visiblePlayers.map((player) => (
                  <button
                    key={`${player.name}-${player.sampleSpid}`}
                    type="button"
                    onClick={() => {
                      const input = findPlayerSearchInput();
                      if (input) setReactInputValue(input, player.name);
                    }}
                    className="flex w-full items-center gap-3 border-b border-white/[0.06] px-3 py-2 text-left last:border-b-0 hover:bg-lime-300/[0.04]"
                  >
                    <div className="relative h-11 w-10 shrink-0 overflow-hidden rounded-lg bg-white/[0.04]">
                      <PlayerArtwork
                        spid={player.sampleSpid}
                        alt={player.name}
                        className="absolute bottom-0 left-1/2 max-h-11 max-w-[135%] -translate-x-1/2 object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-black text-gray-200">{player.name}</p>
                      <p className="mt-0.5 text-[9px] font-bold text-gray-600">
                        {player.position ?? "포지션 미확인"}
                      </p>
                    </div>
                    <span className="shrink-0 text-[9px] font-black text-lime-300">선수 선택 →</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[9px] leading-4 text-gray-600">
                선수를 누르면 위 이름 검색으로 이어집니다. 그다음 원하는 시즌과 강화 단계를 선택하세요.
              </p>
            </>
          )}
        </>
      )}
    </div>,
    mountNode
  );
}
