"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import PlayerArtwork from "@/components/PlayerArtwork";
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

const clockFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
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
      <div className="mt-7 rounded-2xl border border-lime-300/20 bg-[#171b21] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black tracking-[0.12em] text-lime-300">
              FC ONLINE 갱신 기준 시간
            </p>
            <p className="mt-2 font-mono text-2xl font-black tabular-nums sm:text-4xl">
              {nowMs === null ? "--:--:--" : clockFormatter.format(new Date(nowMs))}
            </p>
          </div>
          <span className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-300">
            {clockSource === "server"
              ? "KST · 서버 시간 동기화"
              : clockSource === "device"
                ? "KST · 기기 시계(서버 연결 실패)"
                : "시간 동기화 중"}
          </span>
        </div>
        <p className="mt-3 text-xs leading-5 text-gray-500">
          FC Help 서버 시각을 기준으로 실시간 표시합니다. 넥슨 게임 서버의 직접 측정 시계는 아니며,
          FC 온라인 갱신시간 계산에 사용하는 한국 표준시(KST)입니다.
        </p>
      </div>

      {loading ? (
        <p className="py-20 text-center text-sm text-gray-500">즐겨찾기를 불러오는 중...</p>
      ) : !userId ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-[#171b21] px-6 py-20 text-center">
          <p className="text-lg font-black">로그인 후 즐겨찾기를 사용할 수 있습니다.</p>
          <Link href="/login" className="mt-6 inline-block rounded-xl bg-lime-400 px-5 py-3 text-sm font-bold text-black">
            로그인하기 →
          </Link>
        </div>
      ) : favorites.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-[#171b21] px-6 py-20 text-center">
          <p className="text-lg font-black">저장한 선수가 없습니다.</p>
          <p className="mt-2 text-sm text-gray-400">선수별 즐겨찾기나 갱신 알림을 등록하면 이곳에 표시됩니다.</p>
          <Link href="/refresh" className="mt-6 inline-block rounded-xl bg-lime-400 px-5 py-3 text-sm font-bold text-black">
            갱신시간 검색하기 →
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm text-gray-400">
            저장 선수 {favorites.length}명 · 알림 등록 시 자동으로 즐겨찾기에 추가됩니다.
          </p>
          {dataError && <p role="alert" className="mt-3 text-sm text-red-300">{dataError}</p>}
          {actionError && <p role="alert" className="mt-3 text-sm text-red-300">{actionError}</p>}
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {favorites.map((item) => {
              const info = infoBySpid[item.player_spid];
              const hasPattern = info?.hourType != null && info.minute != null;
              const nextAt = hasPattern && nowMs !== null
                ? nextRefreshAt(info.hourType!, info.minute!, nowMs)
                : null;
              const activeAlertMinutes = alertsBySpid[item.player_spid];
              return (
                <article key={item.player_spid} className="overflow-hidden rounded-2xl border border-white/10 bg-[#181b21]">
                  <Link href={"/refresh/" + item.player_spid} className="block transition hover:bg-white/[0.04]">
                    <div className="flex h-36 items-end justify-center bg-gradient-to-b from-white/5 to-transparent">
                      <PlayerArtwork spid={item.player_spid} alt={item.player_name} className="max-h-full max-w-full object-contain" />
                    </div>
                    <div className="px-5 pt-2">
                      <p className="text-xs font-bold text-lime-300">{item.season_name || "시즌 미확인"}</p>
                      <h2 className="mt-1 text-lg font-black">{item.player_name}</h2>
                    </div>
                  </Link>
                  <div className="px-5 pb-4 pt-4">
                    <div className="rounded-xl border border-white/[0.07] bg-black/15 p-3">
                      <p className="text-[11px] font-bold text-gray-500">갱신 기준 시각</p>
                      <p className="mt-1 text-lg font-black text-lime-300">
                        {hasPattern ? formatPattern(info.hourType!, info.minute!) : dataLoading ? "조회 중..." : "정보 없음"}
                      </p>
                      <p className="mt-1 text-[11px] text-gray-500">
                        {info?.sourceLabel ?? (dataLoading ? "데이터 확인 중" : "갱신시간 확인 중")}
                      </p>
                      {nextAt != null && nowMs !== null ? (
                        <div className="mt-3 border-t border-white/10 pt-3">
                          <p className="text-xs text-gray-400">
                            다음 갱신 구간 · {timeFormatter.format(new Date(nextAt))}
                          </p>
                          <p className="mt-1 font-mono text-2xl font-black tabular-nums text-amber-200">
                            {remainingLabel(nextAt - nowMs)}
                            <span className="ml-2 font-sans text-xs font-normal text-gray-400">남음</span>
                          </p>
                        </div>
                      ) : (
                        <p className="mt-3 border-t border-white/10 pt-3 text-xs text-gray-400">
                          {info?.observationLabel ?? "아직 갱신시간을 확인하고 있습니다."}
                        </p>
                      )}
                    </div>
                    {activeAlertMinutes !== undefined && (
                      <p className="mt-3 text-xs font-bold text-blue-200">
                        🔔 {activeAlertMinutes === 0 ? "갱신 시각" : activeAlertMinutes + "분 전"} 알림 설정됨
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <Link href={"/refresh/" + item.player_spid}
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-300 hover:bg-white/5">
                        상세·알림 설정 →
                      </Link>
                      <button type="button" onClick={() => void removeFavorite(item)} disabled={saving}
                        className="rounded-lg border border-amber-300/20 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-300/10 disabled:opacity-50">
                        ★ 해제
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="mt-5 text-xs leading-5 text-gray-500">
            표시되는 시간은 2시간 거래량 갱신 기준 시각으로, 기준가 변동의 확정 시각이 아닙니다.
            정확한 패턴이 없거나 외부 자료와 충돌하면 남은 시간 대신 확인 중으로 표시합니다.
          </p>
        </>
      )}
    </>
  );
}
