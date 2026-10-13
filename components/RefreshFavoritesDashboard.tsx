"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import PlayerArtwork from "@/components/PlayerArtwork";
import RefreshAlertButton from "@/components/RefreshAlertButton";
import { useFavorites } from "@/components/RefreshFavorites";
import { createClient } from "@/lib/supabase/client";
import { resolveRefreshPattern, type RefreshHourType } from "@/lib/refresh/resolvePattern";
import { observationConflictsWithPattern } from "@/lib/refresh/observationConflict";

type ExactHour = Exclude<RefreshHourType, "unknown">;
type Report = {
  player_spid: number | string;
  hour_type: RefreshHourType;
  refresh_minute: number | null;
};
type Reference = {
  player_spid: number | string;
  hour_type: ExactHour;
  refresh_minute: number;
  confidence: "community_reference" | "verified" | "estimated";
};
type Observation = {
  player_spid: number | string | null;
  observation_kind: "exact" | "range";
  start_hour_type: ExactHour;
  start_minute: number;
  end_hour_type: ExactHour;
  end_minute: number;
  source_status: "estimated" | "reported" | "confirmed";
  source_observed_date: string | null;
};
type TimeInfo = {
  hourType: ExactHour | null;
  minute: number | null;
  sourceLabel: string;
  observationLabel: string | null;
};

const HOUR_LABEL: Record<ExactHour, string> = {
  odd: "홀수",
  even: "짝수",
  every: "매시",
};
const KST_OFFSET = 9 * 60 * 60 * 1000;

function formatPattern(hourType: ExactHour, minute: number) {
  return HOUR_LABEL[hourType] + " " + String(minute).padStart(2, "0") + "분";
}

function observationLabel(row: Observation) {
  const status = row.source_status === "confirmed"
    ? "공개 관측"
    : row.source_status === "reported"
      ? "공개 제보"
      : "추정";
  const start = formatPattern(row.start_hour_type, row.start_minute);
  const end = formatPattern(row.end_hour_type, row.end_minute);
  return (row.observation_kind === "exact" ? start : start + " ~ " + end) +
    " (" + status + " · 참고)";
}

function nextRefreshAt(hourType: ExactHour, minute: number, nowMs: number): number | null {
  const kstNow = new Date(nowMs + KST_OFFSET);
  for (let hourOffset = 0; hourOffset <= 48; hourOffset++) {
    const candidateKst = Date.UTC(
      kstNow.getUTCFullYear(),
      kstNow.getUTCMonth(),
      kstNow.getUTCDate(),
      kstNow.getUTCHours() + hourOffset,
      minute,
      0
    );
    const hour = new Date(candidateKst).getUTCHours();
    if (hourType === "odd" && hour % 2 !== 1) continue;
    if (hourType === "even" && hour % 2 !== 0) continue;
    const target = candidateKst - KST_OFFSET;
    if (target > nowMs) return target;
  }
  return null;
}

// 00~20초: 즐겨찾기 선수의 실제 갱신 주기가 시작된 직후만 강조한다.
function isActiveRefreshWindow(hourType: ExactHour, minute: number, nowMs: number) {
  const kstNow = new Date(nowMs + KST_OFFSET);
  const hour = kstNow.getUTCHours();
  return (
    kstNow.getUTCMinutes() === minute &&
    kstNow.getUTCSeconds() <= 20 &&
    (hourType === "every" ||
      (hourType === "odd" && hour % 2 === 1) ||
      (hourType === "even" && hour % 2 === 0))
  );
}

const timeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function remainingLabel(diffMs: number) {
  const seconds = Math.max(0, Math.ceil(diffMs / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return (hours ? String(hours).padStart(2, "0") + ":" : "") +
    String(minutes).padStart(2, "0") + ":" +
    String(remainingSeconds).padStart(2, "0");
}

export default function RefreshFavoritesDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const { userId, favorites, loading, saving, toggle } = useFavorites();
  const spids = useMemo(() => favorites.map((item) => item.player_spid), [favorites]);
  const spidKey = spids.join(",");

  const referenceClock = useRef<{ epochMs: number; monotonicMs: number } | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [clockSource, setClockSource] = useState<"loading" | "server" | "device">("loading");
  const [infoBySpid, setInfoBySpid] = useState<Record<number, TimeInfo>>({});
  const [alertsBySpid, setAlertsBySpid] = useState<Record<number, number>>({});
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let active = true;

    async function synchronize() {
      const started = performance.now();
      try {
        const response = await fetch("/api/refresh/time", { cache: "no-store" });
        if (!response.ok) throw new Error("Server time unavailable");
        const payload = (await response.json()) as { serverNow?: string };
        const finished = performance.now();
        const ms = Date.parse(payload.serverNow ?? "");
        if (!Number.isFinite(ms)) throw new Error("Invalid server time");
        if (!active) return;
        referenceClock.current = {
          epochMs: ms + (finished - started) / 2,
          monotonicMs: finished,
        };
        setClockSource("server");
        setNowMs(Math.round(referenceClock.current.epochMs));
      } catch {
        if (!active) return;
        referenceClock.current = null;
        setClockSource("device");
        setNowMs(Date.now());
      }
    }

    const tick = () => {
      const saved = referenceClock.current;
      setNowMs(saved
        ? Math.round(saved.epochMs + performance.now() - saved.monotonicMs)
        : Date.now());
    };

    void synchronize();
    const ticker = window.setInterval(tick, 1000);
    const resync = window.setInterval(() => void synchronize(), 60_000);
    const onFocus = () => void synchronize();
    const onVisible = () => {
      if (document.visibilityState === "visible") void synchronize();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(ticker);
      window.clearInterval(resync);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!userId || spids.length === 0) {
      setInfoBySpid({});
      setAlertsBySpid({});
      setDataLoading(false);
      setDataError("");
      return;
    }

    async function loadTimes() {
      setDataLoading(true);
      setDataError("");
      try {
        const [reportResult, referenceResult, observationResult, alertResult] =
          await Promise.all([
            supabase
              .from("refresh_reports")
              .select("player_spid,hour_type,refresh_minute")
              .in("player_spid", spids),
            supabase
              .from("refresh_reference_times")
              .select("player_spid,hour_type,refresh_minute,confidence")
              .in("player_spid", spids),
            supabase
              .from("refresh_observations")
              .select("player_spid,observation_kind,start_hour_type,start_minute,end_hour_type,end_minute,source_status,source_observed_date")
              .in("player_spid", spids)
              .eq("source_type", "scraped_public")
              .order("source_observed_date", { ascending: false })
              .limit(1000),
            supabase
              .from("refresh_alerts")
              .select("player_spid,minutes_before")
              .eq("user_id", userId)
              .eq("enabled", true),
          ]);
        const error = reportResult.error ?? referenceResult.error ??
          observationResult.error ?? alertResult.error;
        if (error) throw error;

        const reports = (reportResult.data ?? []) as Report[];
        const references = (referenceResult.data ?? []) as Reference[];
        const observations = (observationResult.data ?? []) as Observation[];
        const groupedReports = new Map<number, Report[]>();
        const groupedObservations = new Map<number, Observation[]>();
        const referencesBySpid = new Map<number, Reference>();
        for (const row of reports) {
          const spid = Number(row.player_spid);
          groupedReports.set(spid, [...(groupedReports.get(spid) ?? []), row]);
        }
        for (const row of observations) {
          if (row.player_spid == null) continue;
          const spid = Number(row.player_spid);
          groupedObservations.set(spid, [...(groupedObservations.get(spid) ?? []), row]);
        }
        for (const row of references) referencesBySpid.set(Number(row.player_spid), row);

        const nextInfo: Record<number, TimeInfo> = {};
        for (const spid of spids) {
          const reference = referencesBySpid.get(spid);
          const relevant = groupedObservations.get(spid) ?? [];
          const externalConflict = Boolean(reference && relevant.some((observation) =>
            observation.source_status !== "estimated" &&
            observationConflictsWithPattern(observation, reference.hour_type, reference.refresh_minute)
          ));
          const resolved = resolveRefreshPattern(
            groupedReports.get(spid) ?? [],
            reference
              ? {
                hour_type: reference.hour_type,
                refresh_minute: reference.refresh_minute,
                confidence: reference.confidence,
                has_external_conflict: externalConflict,
              }
              : null
          );

          let sourceLabel = "갱신시간 확인 중";
          if (resolved?.source === "reports") {
            sourceLabel = "유저 제보 " + resolved.matchingReportCount + "건 기준";
          } else if (resolved?.source === "reference") {
            sourceLabel = reference?.confidence === "verified"
              ? "검증된 참고값" : "공개 참고값 · 미검증";
          } else if (externalConflict) {
            sourceLabel = "관측 충돌 · 확인 중";
          }

          nextInfo[spid] = {
            hourType: resolved?.hourType ?? null,
            minute: resolved?.minute ?? null,
            sourceLabel,
            observationLabel: relevant.length ? observationLabel(relevant[0]) : null,
          };
        }

        const nextAlerts: Record<number, number> = {};
        for (const row of alertResult.data ?? []) {
          nextAlerts[Number(row.player_spid)] = Number(row.minutes_before);
        }
        if (!active) return;
        setInfoBySpid(nextInfo);
        setAlertsBySpid(nextAlerts);
      } catch (error) {
        if (!active) return;
        console.error("즐겨찾기 갱신시간 조회 실패", error);
        setDataError("갱신시간을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      } finally {
        if (active) setDataLoading(false);
      }
    }

    void loadTimes();
    const reload = window.setInterval(() => void loadTimes(), 120_000);
    return () => {
      active = false;
      window.clearInterval(reload);
    };
    // spidKey avoids refetching because favorite metadata changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, userId, spidKey]);

  // 시계는 갱신 대상 선수가 없어도 매분 00~20초에 강조한다.
  const clockBlinking = nowMs !== null &&
    new Date(nowMs + KST_OFFSET).getUTCSeconds() <= 20;

  async function removeFavorite(item: typeof favorites[number]) {
    setActionError("");
    try {
      await toggle({
        playerSpid: item.player_spid,
        playerName: item.player_name,
        seasonName: item.season_name,
      });
    } catch {
      setActionError("즐겨찾기를 해제하지 못했습니다. 다시 시도해주세요.");
    }
  }

  return (
    <>
      <section
        aria-label="실시간 한국 시각"
        className={"mt-5 flex flex-wrap items-center justify-between gap-x-5 gap-y-2 rounded-xl border bg-[#171b21] px-4 py-3 transition sm:px-5 " +
          (clockBlinking
            ? "refresh-window-border border-lime-300/60"
            : "border-white/10")}
      >
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-wide text-gray-400">
            FC 온라인 갱신 기준 시계 · KST
          </p>
          <p
            className={"mt-0.5 font-mono text-2xl font-black tabular-nums tracking-tight sm:text-3xl " +
              (clockBlinking ? "refresh-window-text text-lime-200" : "text-white")}
          >
            {nowMs === null ? "--:--:--" : (() => {
              const kst = new Date(nowMs + KST_OFFSET);
              return [kst.getUTCHours(), kst.getUTCMinutes(), kst.getUTCSeconds()]
                .map((part) => String(part).padStart(2, "0")).join(":");
            })()}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className={"text-xs font-bold " +
            (clockBlinking ? "text-lime-300" : "text-gray-400")}>
            {clockBlinking ? "갱신시간입니다. 이적시장을 확인해주세요." : clockSource === "server"
              ? "● 서버 시간 동기화"
              : clockSource === "device"
                ? "● 기기 시간 기준"
                : "시계 동기화 중"}
          </p>
          <p className="mt-1 text-[11px] text-gray-600">
            넥슨 서버 직접 측정값이 아닌 FC Help 서버 기준
          </p>
        </div>
      </section>

      {loading ? (
        <p className="py-16 text-center text-sm text-gray-500">즐겨찾기를 불러오는 중...</p>
      ) : !userId ? (
        <div className="mt-5 rounded-xl border border-white/10 bg-[#171b21] px-5 py-12 text-center">
          <p className="font-bold">로그인 후 즐겨찾기를 사용할 수 있습니다.</p>
          <Link href="/login" className="mt-4 inline-block rounded-lg bg-lime-400 px-4 py-2.5 text-sm font-bold text-black">
            로그인하기 →
          </Link>
        </div>
      ) : favorites.length === 0 ? (
        <div className="mt-5 rounded-xl border border-white/10 bg-[#171b21] px-5 py-12 text-center">
          <p className="font-bold">즐겨찾기한 선수가 없습니다.</p>
          <p className="mt-1 text-xs text-gray-500">알림을 등록하거나 선수별 ☆ 버튼을 누르면 여기에 추가됩니다.</p>
          <Link href="/refresh" className="mt-4 inline-block rounded-lg bg-lime-400 px-4 py-2.5 text-sm font-bold text-black">
            선수 검색하기 →
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between gap-3 text-xs text-gray-500">
            <span>즐겨찾기 {favorites.length}명</span>
          </div>
          {dataError && <p role="alert" className="mt-2 text-xs text-red-300">{dataError}</p>}
          {actionError && <p role="alert" className="mt-2 text-xs text-red-300">{actionError}</p>}

          <div className="mt-3 flex flex-col gap-2.5">
            {favorites.map((item) => {
              const info = infoBySpid[item.player_spid];
              const hasPattern = info?.hourType != null && info.minute != null;
              const isRefreshing = hasPattern && nowMs !== null
                ? isActiveRefreshWindow(info.hourType!, info.minute!, nowMs)
                : false;
              const nextAt = hasPattern && nowMs !== null
                ? nextRefreshAt(info.hourType!, info.minute!, nowMs)
                : null;

              return (
                <article
                  key={item.player_spid}
                  className={"flex min-h-[82px] w-full items-center gap-3 rounded-xl border bg-[#171b21] px-3 py-2.5 transition sm:gap-4 sm:px-4 " +
                    (isRefreshing
                      ? "refresh-window-player border-lime-300/75"
                      : "border-white/10")}
                >
                  <Link
                    href={"/refresh/" + item.player_spid}
                    className="flex h-14 w-14 shrink-0 items-end justify-center overflow-hidden rounded-lg bg-white/[0.04] sm:h-16 sm:w-16"
                    aria-label={item.season_name + " " + item.player_name + " 갱신정보"}
                  >
                    <PlayerArtwork
                      spid={item.player_spid}
                      alt={item.player_name}
                      className="max-h-full max-w-full object-contain"
                    />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link href={"/refresh/" + item.player_spid} className="flex min-w-0 flex-col items-start gap-1 hover:text-lime-200">
                      <span className="max-w-full rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-bold text-lime-300">
                        {item.season_name || "시즌"}
                      </span>
                      <h2 className="w-full whitespace-normal break-words text-sm font-bold leading-5 text-white sm:text-base">
                        {item.player_name}
                      </h2>
                      <p
                        title={info?.sourceLabel ?? "갱신시간 확인 중"}
                        className={"w-full text-xs font-semibold leading-4 sm:text-sm " +
                          (isRefreshing ? "refresh-window-text text-lime-200" : "text-lime-300")}
                      >
                        {hasPattern
                          ? formatPattern(info.hourType!, info.minute!)
                          : dataLoading ? "갱신시간 조회 중" : info?.observationLabel ?? "갱신시간 미확인"}
                        {hasPattern && info?.sourceLabel === "공개 참고값 · 미검증" &&
                          <span className="ml-1 text-[10px] font-normal text-gray-500">· 참고</span>}
                      </p>
                    </Link>
                  </div>

                  <div className="flex w-[94px] shrink-0 flex-col items-end justify-center gap-1 sm:w-[150px]">
                    {isRefreshing ? (
                      <p className="refresh-window-text text-right text-sm font-black text-lime-200 sm:text-base">
                        갱신 예상 시각
                      </p>
                    ) : nextAt !== null && nowMs !== null ? (
                      <>
                        <p className="text-[10px] text-gray-500">
                          다음 {timeFormatter.format(new Date(nextAt))}
                        </p>
                        <p className="font-mono text-sm font-black tabular-nums text-amber-200 sm:text-lg">
                          {remainingLabel(nextAt - nowMs)}
                        </p>
                      </>
                    ) : (
                      <p className="text-right text-xs text-gray-500">시간 확인 중</p>
                    )}
                    <RefreshAlertButton
                      playerSpid={item.player_spid}
                      playerName={item.player_name}
                      seasonName={item.season_name}
                      compact
                      onAlertChange={(minutesBefore) =>
                        setAlertsBySpid((previous) => {
                          const updated = { ...previous };
                          if (minutesBefore === null) delete updated[item.player_spid];
                          else updated[item.player_spid] = minutesBefore;
                          return updated;
                        })
                      }
                    />
                    <button
                      type="button"
                      onClick={() => void removeFavorite(item)}
                      disabled={saving}
                      aria-label={item.player_name + " 즐겨찾기 해제"}
                      title="즐겨찾기 해제"
                      className="mt-0.5 rounded-md px-2 py-0.5 text-xs font-bold text-amber-300 transition hover:bg-amber-300/10 disabled:opacity-50"
                    >
                      ★ 해제
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="mt-4 text-[11px] leading-5 text-gray-600">
            갱신 시각은 거래량 업데이트 기준이며 실제 기준가 변동을 보장하지 않습니다.
            공개 참고값은 미검증일 수 있으며, 대표 시간이 확정되지 않은 선수는 강조하지 않습니다.
          </p>
        </>
      )}
    </>
  );
}
