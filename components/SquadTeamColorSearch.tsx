"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type TeamColorPlayer = {
  name: string;
  sampleSpid: number;
  seasonCount: number;
};

function findPlayerSearchInput() {
  return document.querySelector<HTMLInputElement>(
    'input[placeholder="선수 이름 검색"], input[placeholder="골키퍼 이름 검색"]'
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
  const [teamColor, setTeamColor] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [items, setItems] = useState<TeamColorPlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      setNameQuery(input.value);
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (currentMount?.isConnected) currentMount.remove();
    };
  }, []);

  useEffect(() => {
    if (!playerInput) return;
    const syncName = () => setNameQuery(playerInput.value);
    playerInput.addEventListener("input", syncName);
    return () => playerInput.removeEventListener("input", syncName);
  }, [playerInput]);

  const normalizedTeamColor = teamColor.trim();
  const normalizedName = nameQuery.trim();

  useEffect(() => {
    if (!mountNode || normalizedTeamColor.length < 2) {
      setItems([]);
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ teamColor: normalizedTeamColor });
        if (normalizedName) params.set("q", normalizedName);
        const response = await fetch(`/api/squad/team-color-search?${params.toString()}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "팀컬러 검색 실패");
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch (requestError) {
        if (controller.signal.aborted) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "팀컬러 선수 검색에 실패했습니다."
        );
        setItems([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [mountNode, normalizedTeamColor, normalizedName]);

  const visibleItems = useMemo(() => items.slice(0, 20), [items]);

  if (!mountNode) return null;

  return createPortal(
    <div className="mt-2 rounded-xl border border-white/10 bg-black/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black text-lime-300">팀컬러로 선수 찾기</p>
          <p className="mt-0.5 text-[9px] text-gray-500">
            소속 클럽·국가 팀컬러를 입력하면 해당 선수만 찾아줍니다.
          </p>
        </div>
        {normalizedTeamColor && (
          <button
            type="button"
            onClick={() => setTeamColor("")}
            className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-[9px] font-bold text-gray-400 hover:bg-white/5 hover:text-white"
          >
            초기화
          </button>
        )}
      </div>

      <input
        value={teamColor}
        onChange={(event) => setTeamColor(event.target.value)}
        placeholder="예: 레알 마드리드, 바이에른 뮌헨, 대한민국"
        className="mt-2.5 w-full rounded-lg border border-white/10 bg-[#0f1115] px-3 py-2.5 text-xs font-bold text-white outline-none placeholder:font-medium placeholder:text-gray-600 focus:border-lime-400/50"
      />

      {normalizedTeamColor.length > 0 && normalizedTeamColor.length < 2 && (
        <p className="mt-2 text-[10px] text-gray-500">팀컬러 이름을 2글자 이상 입력하세요.</p>
      )}
      {loading && (
        <p className="mt-3 py-2 text-center text-[10px] font-bold text-gray-500">
          팀컬러 선수를 찾는 중...
        </p>
      )}
      {!loading && error && (
        <p className="mt-3 rounded-lg bg-red-400/5 px-3 py-2 text-[10px] font-bold text-red-300">
          {error}
        </p>
      )}
      {!loading && !error && normalizedTeamColor.length >= 2 && visibleItems.length === 0 && (
        <p className="mt-3 py-2 text-center text-[10px] text-gray-500">
          해당 팀컬러에서 선수를 찾지 못했습니다. 공식 팀컬러 이름으로 다시 검색해보세요.
        </p>
      )}

      {!loading && !error && visibleItems.length > 0 && (
        <div className="mt-3 max-h-44 overflow-y-auto rounded-lg border border-white/[0.07] bg-[#0f1115]">
          {visibleItems.map((player) => (
            <button
              key={`${player.name}-${player.sampleSpid}`}
              type="button"
              onClick={() => {
                const input = findPlayerSearchInput();
                if (input) setReactInputValue(input, player.name);
              }}
              className="flex w-full items-center justify-between gap-3 border-b border-white/[0.06] px-3 py-2.5 text-left last:border-b-0 hover:bg-lime-300/[0.04]"
            >
              <span className="truncate text-xs font-black text-gray-200">{player.name}</span>
              <span className="shrink-0 text-[9px] font-bold text-gray-600">
                {player.seasonCount}개 시즌 · 선택 →
              </span>
            </button>
          ))}
        </div>
      )}

      {!loading && visibleItems.length > 0 && (
        <p className="mt-2 text-[9px] leading-4 text-gray-600">
          선수를 누르면 위 이름 검색에 자동 입력됩니다. 이후 원하는 시즌과 강화 단계를 선택하세요.
        </p>
      )}
    </div>,
    mountNode
  );
}
