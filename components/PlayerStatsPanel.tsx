"use client";

import { useMemo, useRef, useState } from "react";
import type { PlayerStatsData } from "@/lib/fconline/playerStats";
import type {
  PlayerTeamColors,
  TeamColorOption,
} from "@/lib/fconline/teamColors";

type Props = {
  spid: number;
  initialStrong: number;
  initialGrow: 1 | 5;
  initialStats: PlayerStatsData | null;
  initialTeamColors: PlayerTeamColors;
  initialReinforcementPick: number | null;
  initialAffiliationPick: number | null;
  initialFeaturePick: number | null;
};

type ApiResponse = {
  stats: PlayerStatsData;
  teamColors: PlayerTeamColors;
};

function getStatTextTone(value: number) {
  if (value >= 170) return "text-[#67d7ff]";
  if (value >= 160) return "text-[#61e7cb]";
  if (value >= 150) return "text-[#f2c86b]";
  if (value >= 140) return "text-[#ffb75d]";
  if (value >= 130) return "text-[#ff7b73]";
  if (value >= 120) return "text-[#c892ff]";
  if (value >= 110) return "text-[#85d96f]";
  if (value >= 100) return "text-[#67c9a5]";
  if (value >= 90) return "text-[#70b8e8]";
  return "text-gray-200";
}

function getTeamColorLevelTone(level: number) {
  if (level >= 5) return "border-rose-400/40 bg-rose-400/15 text-rose-300";
  if (level === 4) return "border-amber-400/40 bg-amber-400/15 text-amber-300";
  if (level === 3) return "border-violet-400/40 bg-violet-400/15 text-violet-300";
  if (level === 2) return "border-emerald-400/40 bg-emerald-400/15 text-emerald-300";
  return "border-sky-400/40 bg-sky-400/15 text-sky-300";
}

function selectedOption(options: TeamColorOption[], index: number | null) {
  return index === null ? null : options[index] ?? null;
}

function findEquivalentIndex(
  options: TeamColorOption[],
  selected: TeamColorOption | null
) {
  if (!selected) return null;
  const index = options.findIndex(
    (option) =>
      option.name === selected.name &&
      option.level === selected.level &&
      option.category === selected.category
  );
  return index >= 0 ? index : null;
}

export default function PlayerStatsPanel({
  spid,
  initialStrong,
  initialGrow,
  initialStats,
  initialTeamColors,
  initialReinforcementPick,
  initialAffiliationPick,
  initialFeaturePick,
}: Props) {
  const [strong, setStrong] = useState(initialStrong);
  const [grow, setGrow] = useState<1 | 5>(initialGrow);
  const [stats, setStats] = useState(initialStats);
  const [teamColors, setTeamColors] = useState(initialTeamColors);
  const [reinforcementPick, setReinforcementPick] = useState<number | null>(
    initialReinforcementPick
  );
  const [affiliationPick, setAffiliationPick] = useState<number | null>(
    initialAffiliationPick
  );
  const [featurePick, setFeaturePick] = useState<number | null>(
    initialFeaturePick
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const reinforcement = selectedOption(
    teamColors.reinforcement,
    reinforcementPick
  );
  const affiliation = selectedOption(teamColors.affiliation, affiliationPick);
  const feature = selectedOption(teamColors.feature, featurePick);
  const selectedTeamColors = [reinforcement, affiliation, feature].filter(
    (item): item is TeamColorOption => Boolean(item)
  );

  const adjustedAbilities = useMemo(() => {
    if (!stats) return [];

    const specific = new Map<string, number>();
    let overall = 0;

    for (const teamColor of selectedTeamColors) {
      for (const effect of teamColor.effects) {
        if (effect.label === "전체 능력치") {
          overall += effect.value;
        } else {
          specific.set(
            effect.label,
            (specific.get(effect.label) ?? 0) + effect.value
          );
        }
      }
    }

    return stats.abilities.map((stat) => {
      const teamBonus = overall + (specific.get(stat.label) ?? 0);
      return {
        ...stat,
        teamBonus,
        value: Math.min(200, stat.value + teamBonus),
      };
    });
  }, [stats, selectedTeamColors]);

  function replaceUrl(
    nextStrong: number,
    nextGrow: 1 | 5,
    nextReinforcement: number | null,
    nextAffiliation: number | null,
    nextFeature: number | null
  ) {
    const params = new URLSearchParams({
      strong: String(nextStrong),
      grow: String(nextGrow),
    });

    if (nextReinforcement !== null)
      params.set("tcR", String(nextReinforcement));
    if (nextAffiliation !== null) params.set("tcA", String(nextAffiliation));
    if (nextFeature !== null) params.set("tcF", String(nextFeature));

    window.history.replaceState(
      null,
      "",
      `/players/${spid}?${params.toString()}`
    );
  }

  async function loadBaseStats(nextStrong: number, nextGrow: 1 | 5) {
    if (nextStrong === strong && nextGrow === grow) return;

    const currentReinforcement = reinforcement;
    const currentAffiliation = affiliation;
    const currentFeature = feature;
    const currentRequest = ++requestId.current;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/players/${spid}/stats?strong=${nextStrong}&grow=${nextGrow}`,
        { cache: "no-store" }
      );

      if (!response.ok) throw new Error("stats request failed");
      const data = (await response.json()) as ApiResponse;
      if (currentRequest !== requestId.current) return;

      const nextReinforcementPick = findEquivalentIndex(
        data.teamColors.reinforcement,
        currentReinforcement
      );
      const nextAffiliationPick = findEquivalentIndex(
        data.teamColors.affiliation,
        currentAffiliation
      );
      const nextFeaturePick = findEquivalentIndex(
        data.teamColors.feature,
        currentFeature
      );

      setStrong(nextStrong);
      setGrow(nextGrow);
      setStats(data.stats);
      setTeamColors(data.teamColors);
      setReinforcementPick(nextReinforcementPick);
      setAffiliationPick(nextAffiliationPick);
      setFeaturePick(nextFeaturePick);
      replaceUrl(
        nextStrong,
        nextGrow,
        nextReinforcementPick,
        nextAffiliationPick,
        nextFeaturePick
      );
    } catch {
      if (currentRequest === requestId.current) {
        setError("능력치를 다시 불러오지 못했습니다.");
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }

  function chooseTeamColor(
    category: "reinforcement" | "affiliation" | "feature",
    index: number
  ) {
    let nextR = reinforcementPick;
    let nextA = affiliationPick;
    let nextF = featurePick;

    if (category === "reinforcement") {
      nextR = reinforcementPick === index ? null : index;
      setReinforcementPick(nextR);
    } else if (category === "affiliation") {
      nextA = affiliationPick === index ? null : index;
      setAffiliationPick(nextA);
    } else {
      nextF = featurePick === index ? null : index;
      setFeaturePick(nextF);
    }

    replaceUrl(strong, grow, nextR, nextA, nextF);
  }

  function clearTeamColors() {
    setReinforcementPick(null);
    setAffiliationPick(null);
    setFeaturePick(null);
    replaceUrl(strong, grow, null, null, null);
  }

  return (
    <section className="mt-12 rounded-2xl border border-white/10 bg-[#181b21] p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-lime-400">PLAYER STATS</p>
          <h2 className="mt-1 text-2xl font-bold">상세 능력치</h2>
          <p className="mt-2 text-sm text-gray-500">
            강화 +{strong} · 적응도 {grow} · 팀컬러 {selectedTeamColors.length}/3 적용
          </p>
        </div>
        {stats && (
          <a
            href={stats.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-gray-400 transition hover:text-white"
          >
            공식 데이터센터 원본 ↗
          </a>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-sm font-semibold">
        <span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
          +{strong}강
        </span>
        <span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
          적응도 {grow}
        </span>
        {selectedTeamColors.map((color, index) => (
          <span
            key={`${color.name}-${color.level}-${index}`}
            className="rounded-lg border border-lime-400/30 bg-lime-400/10 px-3 py-2 text-lime-300"
          >
            {color.name}
          </span>
        ))}
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <StatOptionSection title="강화">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {Array.from({ length: 13 }, (_, index) => index + 1).map((level) => (
              <button
                key={level}
                type="button"
                disabled={loading}
                onClick={() => loadBaseStats(level, grow)}
                className={`flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm font-bold transition disabled:opacity-50 ${
                  strong === level
                    ? "border-lime-400 bg-lime-400 text-black"
                    : "border-white/10 bg-white/[0.04] text-gray-400 hover:border-white/30 hover:text-white"
                }`}
              >
                +{level}
              </button>
            ))}
          </div>
        </StatOptionSection>

        <StatOptionSection title="적응도">
          <div className="flex gap-2">
            {([1, 5] as const).map((level) => (
              <button
                key={level}
                type="button"
                disabled={loading}
                onClick={() => loadBaseStats(strong, level)}
                className={`flex h-10 min-w-16 items-center justify-center rounded-lg border px-4 text-sm font-bold transition disabled:opacity-50 ${
                  grow === level
                    ? "border-lime-400 bg-lime-400 text-black"
                    : "border-white/10 bg-white/[0.04] text-gray-400 hover:border-white/30 hover:text-white"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </StatOptionSection>
      </div>

      {(loading || error) && (
        <p className={`mt-3 text-xs ${error ? "text-red-300" : "text-gray-500"}`}>
          {error || "공식 데이터센터에서 능력치만 갱신하는 중..."}
        </p>
      )}

      <div className="mt-8 rounded-2xl border border-white/10 bg-[#12151a] p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-300">적용 가능한 팀컬러</p>
            <p className="mt-1 text-xs text-gray-500">
              팀컬러 선택은 서버 이동 없이 즉시 능력치에 반영됩니다.
            </p>
          </div>
          {selectedTeamColors.length > 0 && (
            <button
              type="button"
              onClick={clearTeamColors}
              className="text-left text-sm font-semibold text-gray-400 hover:text-white"
            >
              전체 해제
            </button>
          )}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <TeamColorList
            title="강화 팀컬러"
            emptyText="현재 강화 단계에서 받을 수 있는 강화 팀컬러가 없습니다."
            options={teamColors.reinforcement}
            selectedIndex={reinforcementPick}
            onSelect={(index) => chooseTeamColor("reinforcement", index)}
          />
          <TeamColorList
            title="소속 팀컬러"
            emptyText="적용 가능한 소속 팀컬러가 없습니다."
            options={teamColors.affiliation}
            selectedIndex={affiliationPick}
            onSelect={(index) => chooseTeamColor("affiliation", index)}
          />
          <TeamColorList
            title="관계/특성 팀컬러"
            emptyText="적용 가능한 관계/특성 팀컬러가 없습니다."
            options={teamColors.feature}
            selectedIndex={featurePick}
            onSelect={(index) => chooseTeamColor("feature", index)}
          />
        </div>
      </div>

      {!stats ? (
        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-10 text-center">
          <p className="font-semibold">능력치를 불러오지 못했습니다.</p>
          <p className="mt-2 text-sm text-gray-500">
            FC 온라인 데이터센터 응답을 확인해주세요.
          </p>
        </div>
      ) : (
        <div className="mt-8 rounded-2xl border border-white/10 bg-[#12151a] p-5">
          <div className="grid md:grid-cols-2 xl:grid-cols-3 xl:gap-x-8">
            {adjustedAbilities.map((stat, index) => (
              <div
                key={`${stat.label}-${index}`}
                className="flex min-h-12 items-center justify-between gap-4 border-b border-white/5 py-2.5"
              >
                <span className="text-sm text-gray-400">{stat.label}</span>
                <div className="flex items-baseline gap-2">
                  {stat.teamBonus > 0 && (
                    <span className="text-[11px] font-semibold text-lime-400/80">
                      +{stat.teamBonus}
                    </span>
                  )}
                  <span
                    className={`text-xl font-extrabold tabular-nums ${getStatTextTone(
                      stat.value
                    )}`}
                  >
                    {stat.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function TeamColorList({
  title,
  options,
  selectedIndex,
  emptyText,
  onSelect,
}: {
  title: string;
  options: TeamColorOption[];
  selectedIndex: number | null;
  emptyText: string;
  onSelect: (index: number) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-bold">{title}</p>
        <span className="text-xs text-gray-600">1개 선택</span>
      </div>

      {options.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-5 text-xs leading-5 text-gray-500">
          {emptyText}
        </p>
      ) : (
        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {options.map((teamColor, index) => {
            const active = selectedIndex === index;
            return (
              <button
                key={`${teamColor.name}-${teamColor.level}-${index}`}
                type="button"
                onClick={() => onSelect(index)}
                className={`block w-full rounded-xl border p-3 text-left transition ${
                  active
                    ? "border-lime-400/60 bg-lime-400/10"
                    : "border-white/10 bg-white/[0.03] hover:border-white/25"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p
                    className={`text-sm font-bold ${
                      active ? "text-lime-300" : "text-white"
                    }`}
                  >
                    {teamColor.name}
                  </p>
                  <span
                    className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-extrabold ${getTeamColorLevelTone(
                      teamColor.level
                    )}`}
                  >
                    {teamColor.level}단계
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] leading-5 text-gray-500">
                  {teamColor.effects
                    .map((effect) => `${effect.label} +${effect.value}`)
                    .join(" · ")}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatOptionSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-gray-300">{title}</p>
      {children}
    </div>
  );
}
