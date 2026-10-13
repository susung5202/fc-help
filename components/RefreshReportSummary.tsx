"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveRefreshPattern, type RefreshReferencePatternRow } from "@/lib/refresh/resolvePattern";
import { observationConflictsWithPattern } from "@/lib/refresh/observationConflict";

type HourType = "odd" | "even" | "every" | "unknown";

type Report = {
  id: number;
  hour_type: HourType;
  refresh_minute: number | null;
  created_at: string;
};

type Props = {
  playerSpid: number;
  playerName: string;
  seasonName: string;
};

type Observation = {
  id: number;
  observation_kind: "exact" | "range";
  start_hour_type: Exclude<HourType, "unknown">;
  start_minute: number;
  end_hour_type: Exclude<HourType, "unknown">;
  end_minute: number;
  source_name: string;
  source_url: string;
  source_type: "scraped_public" | "user_report" | "manual" | "fc_help";
  source_observation_count: number;
  source_status: "estimated" | "reported" | "confirmed";
  source_observed_date: string | null;
};

type Reference = RefreshReferencePatternRow & {
  source_name: string;
  source_url: string;
  source_published_at: string | null;
  confidence: "community_reference" | "verified" | "estimated";
};

type Distribution = {
  key: string;
  hourType: HourType;
  minute: number;
  count: number;
  percentage: number;
};

export default function RefreshReportSummary({
  playerSpid,
  playerName,
  seasonName,
}: Props) {
  const [reports, setReports] = useState<Report[]>([]);
  const [reference, setReference] = useState<Reference | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [showAllObservations, setShowAllObservations] = useState(false);
  const [showMobileDetails, setShowMobileDetails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    async function loadReports() {
      const supabase = createClient();

      const [
        { data: reportData, error: reportError },
        { data: referenceData, error: referenceError },
        { data: observationsBySpid, error: observationsBySpidError },
        { data: observationsByName, error: observationsByNameError },
      ] = await Promise.all([
        supabase
          .from("refresh_reports")
          .select("id, hour_type, refresh_minute, created_at")
          .eq("player_spid", playerSpid)
          .order("created_at", { ascending: false }),
        supabase
          .from("refresh_reference_times")
          .select("hour_type, refresh_minute, source_name, source_url, source_published_at, confidence")
          .eq("player_spid", playerSpid)
          .maybeSingle(),
        supabase
          .from("refresh_observations")
          .select("id, observation_kind, start_hour_type, start_minute, end_hour_type, end_minute, source_name, source_url, source_type, source_observation_count, source_status, source_observed_date")
          .eq("player_spid", playerSpid)
          .order("source_observed_date", { ascending: false }),
        supabase
          .from("refresh_observations")
          .select("id, observation_kind, start_hour_type, start_minute, end_hour_type, end_minute, source_name, source_url, source_type, source_observation_count, source_status, source_observed_date")
          .eq("player_name", playerName)
          .eq("season_name", seasonName)
          .order("source_observed_date", { ascending: false }),
      ]);

      const observationError =
        observationsBySpidError || observationsByNameError;

      if (reportError || referenceError || observationError) {
        console.log(
          "갱신시간 정보 불러오기 실패:",
          reportError?.message ||
            referenceError?.message ||
            observationError?.message
        );
        setLoading(false);
        return;
      }

      const mergedObservations = new Map<number, Observation>();
      for (const row of [
        ...((observationsBySpid ?? []) as Observation[]),
        ...((observationsByName ?? []) as Observation[]),
      ]) {
        mergedObservations.set(row.id, row);
      }

      setReports((reportData ?? []) as Report[]);
      setReference((referenceData as Reference | null) ?? null);
      setObservations(Array.from(mergedObservations.values()));
      setLoading(false);
    }

    loadReports();
  }, [playerSpid, playerName, seasonName]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const validReports = reports.filter(
      (report) =>
        report.hour_type !== "unknown" &&
        report.refresh_minute !== null
    );

    if (validReports.length === 0) {
      return null;
    }

    const counts = new Map<
      string,
      {
        hourType: HourType;
        minute: number;
        count: number;
      }
    >();

    for (const report of validReports) {
      if (report.refresh_minute === null) {
        continue;
      }

      const key = `${report.hour_type}-${report.refresh_minute}`;

      const current = counts.get(key);

      if (current) {
        current.count += 1;
      } else {
        counts.set(key, {
          hourType: report.hour_type,
          minute: report.refresh_minute,
          count: 1,
        });
      }
    }

    const distribution: Distribution[] = Array.from(
      counts.entries()
    )
      .map(([key, value]) => ({
        key,
        hourType: value.hourType,
        minute: value.minute,
        count: value.count,
        percentage: Math.round(
          (value.count / validReports.length) * 100
        ),
      }))
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }

        return a.minute - b.minute;
      });

    const topCount = distribution[0]?.count ?? 0;

    const topCandidates = distribution.filter(
      (item) => item.count === topCount
    );

    const isTie = topCandidates.length > 1;

    const winner = isTie
      ? null
      : topCandidates[0] ?? null;

    const confidence = winner
      ? Math.round(
          (winner.count / validReports.length) * 100
        )
      : Math.round(
          (topCount / validReports.length) * 100
        );

    return {
      validReports: validReports.length,
      distribution,
      topCandidates,
      winner,
      isTie,
      confidence,
    };
  }, [reports]);

  const hasExternalConflict = useMemo(
    () =>
      Boolean(
        reference &&
          observations.some(
            (observation) =>
              observation.source_type === "scraped_public" &&
              observation.source_status !== "estimated" &&
              observationConflictsWithPattern(
                observation,
                reference.hour_type,
                reference.refresh_minute
              )
          )
      ),
    [observations, reference]
  );

  const resolvedPattern = useMemo(
    () =>
      resolveRefreshPattern(
        reports,
        reference
          ? {
              hour_type: reference.hour_type,
              refresh_minute: reference.refresh_minute,
              source_name: reference.source_name,
              source_url: reference.source_url,
              confidence: reference.confidence,
              has_external_conflict: hasExternalConflict,
            }
          : null
      ),
    [reports, reference, hasExternalConflict]
  );

  if (loading) {
    return (
      <div className="mt-12 rounded-2xl border border-white/10 bg-[#181b21] p-8 text-center text-sm text-gray-500">
        갱신시간 정보를 불러오는 중...
      </div>
    );
  }

  const expectedRefresh = resolvedPattern
    ? formatRefreshPattern(resolvedPattern.hourType, resolvedPattern.minute)
    : stats?.isTie
      ? "의견 갈림"
      : "-";

  const nextRefresh = resolvedPattern
    ? getNextRefresh(
        resolvedPattern.hourType,
        resolvedPattern.minute,
        now
      )
    : "-";

  return (
    <>
      <section id="refresh-summary" className="mt-5 scroll-mt-16 rounded-2xl border border-white/10 bg-[#181b21] p-3 sm:p-6 md:mt-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-lime-400">
              REFRESH TIME
            </p>

            <h2 className="mt-1 text-xl font-bold sm:text-2xl">
              갱신시간
            </h2>
          </div>
        </div>

        <p className="mt-2 max-w-3xl text-xs leading-5 text-gray-400 sm:mt-3 sm:text-sm sm:leading-6">
          거래량 갱신 기준 시각입니다. 실제 기준가·상한가·하한가의 변경 시각과는 다를 수 있습니다.
          <span className="hidden sm:inline"> 변경은 이후 약 0~20분 사이에 발생할 수 있습니다.</span>
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-8 sm:gap-4 lg:grid-cols-4">
          <InfoBox
            title="갱신 기준 시각"
            value={expectedRefresh}
          />

          <InfoBox
            title="다음 구간 시작"
            value={nextRefresh}
          />

          <InfoBox
            title="근거"
            value={
              resolvedPattern?.source === "reference"
                ? reference?.confidence === "verified"
                  ? "검증 기준값"
                  : "공개 참고 · 미검증"
                : stats
                  ? `제보 ${stats.confidence}%`
                  : "-"
            }
          />

          <InfoBox
            title="유효 제보"
            value={`${stats?.validReports ?? 0}건`}
          />
        </div>

        <button
          type="button"
          aria-expanded={showMobileDetails}
          onClick={() => setShowMobileDetails((value) => !value)}
          className="mt-3 w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2.5 text-xs font-bold text-gray-200 md:hidden"
        >
          {showMobileDetails ? "출처·제보 상세 접기 ↑" : "출처·제보 자세히 보기 ↓"}
        </button>

        {!stats && !reference && (
          <div className="mt-6 rounded-xl border border-dashed border-white/10 px-5 py-10 text-center">
            <p className="font-semibold">
              아직 확인된 갱신시간이 없습니다.
            </p>

            <p className="mt-2 text-sm text-gray-500">
              첫 갱신시간 제보를 남기면 대표값과 알림 계산에 자동으로 반영됩니다.
              위에서 알림을 먼저 등록해두면 갱신시간이 확보된 뒤 기존 설정으로 알림이 적용됩니다.
            </p>
          </div>
        )}

        <div className={showMobileDetails ? "block" : "hidden md:block"}>
        {observations.length > 0 && (
          <div className="mt-6 rounded-xl border border-violet-300/15 bg-violet-300/[0.04] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-violet-200">
                  갱신시간 참고 근거 {observations.length}건
                </p>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  각 기록의 원문 출처를 확인할 수 있습니다. 공개 자료는 FC Help 독립 검증 전 참고값이며, 범위 관측은 정확한 알림 시각으로 사용하지 않습니다.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {(showAllObservations ? observations : observations.slice(0, 5)).map((observation) => (
                <div
                  key={observation.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/10 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-200">
                      {formatObservation(observation)}
                    </p>
                    <p className="mt-1 text-[11px] text-gray-600">
                      {observation.source_name}
                      {observation.source_observation_count > 1
                        ? ` · 관측 ${observation.source_observation_count}회`
                        : ""}
                      {observation.source_observed_date
                        ? ` · ${new Date(
                            `${observation.source_observed_date}T00:00:00+09:00`
                          ).toLocaleDateString("ko-KR")}`
                        : ""}
                    </p>
                  </div>
                  <a
                    href={observation.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-300 transition hover:bg-white/5"
                  >
                    출처
                  </a>
                </div>
              ))}
            </div>
            {observations.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllObservations((value) => !value)}
                className="mt-4 text-sm font-semibold text-violet-200 hover:text-white"
              >
                {showAllObservations
                  ? "근거 접기"
                  : `전체 근거 ${observations.length}건 보기`}
              </button>
            )}
          </div>
        )}

        {reference && (
          <div className="mt-6 rounded-xl border border-sky-300/15 bg-sky-300/[0.04] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-sky-200">
                  초기 참고 기준값 · {formatRefreshPattern(reference.hour_type, reference.refresh_minute)}
                </p>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  유저 제보가 충분히 쌓이기 전까지 사용하는 공개 자료 기반 거래량 갱신 기준값입니다.
                  FC Help가 아직 독립 검증하지 않은 참고값이며, 제보가 2건 이상 같은 다른 시간을 가리키면 제보값이 우선됩니다.
                </p>
              </div>
              <a
                href={reference.source_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-300 transition hover:bg-white/5"
              >
                출처 보기
              </a>
            </div>
            <p className="mt-3 text-[11px] text-gray-600">
              {reference.source_name}
              {reference.source_published_at
                ? ` · ${new Date(reference.source_published_at).toLocaleDateString("ko-KR")}`
                : ""}
            </p>
          </div>
        )}

        </div>

        {hasExternalConflict && (
          <div className="mt-4 rounded-xl border border-red-300/20 bg-red-300/[0.05] px-4 py-3 text-xs leading-5 text-red-100">
            독립 공개 출처의 exact 기록과 기존 참고값이 충돌해 자동 알림 기준에서 제외했습니다.
            추가 관측이 쌓여 값이 확인되면 다시 적용됩니다.
          </div>
        )}

        {resolvedPattern?.source === "reference" &&
          resolvedPattern.conflictsWithReference && (
            <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] px-4 py-3 text-xs leading-5 text-amber-100">
              참고값과 다른 유저 제보가 있어 확인 중입니다. 한 건의 제보만으로 기존 기준값을 바로 덮어쓰지는 않습니다.
            </div>
          )}

        {stats?.isTie && (
          <div className="mt-6 rounded-xl border border-yellow-400/20 bg-yellow-400/5 p-5">
            <p className="font-bold text-yellow-300">
              갱신시간 의견이 갈리고 있습니다.
            </p>

            <p className="mt-2 text-sm leading-6 text-gray-400">
              가장 많은 표를 받은 갱신시간이 여러 개라
              아직 대표 갱신시간을 확정하지 않았습니다.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {stats.topCandidates.map((candidate) => (
                <span
                  key={candidate.key}
                  className="rounded-lg bg-yellow-400/10 px-3 py-2 text-sm font-semibold text-yellow-200"
                >
                  {formatRefreshPattern(
                    candidate.hourType,
                    candidate.minute
                  )}{" "}
                  · {candidate.count}표
                </span>
              ))}
            </div>
          </div>
        )}

        {stats && !stats.isTie && stats.winner && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-gray-500">
                대표 제보 일치도
              </span>

              <span className="font-semibold">
                {stats.winner.count} /{" "}
                {stats.validReports}건 일치
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-lime-400 transition-all"
                style={{
                  width: `${stats.confidence}%`,
                }}
              />
            </div>
          </div>
        )}
      </section>

      <div className={showMobileDetails ? "block" : "hidden md:block"}>
      {stats && (
        <section className="mt-4 rounded-2xl border border-white/10 bg-[#181b21] p-3 sm:mt-6 sm:p-6">
          <div>
            <p className="text-sm font-semibold text-lime-400">
              REPORT DISTRIBUTION
            </p>

            <h2 className="mt-1 text-2xl font-bold">
              제보 분포
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              어떤 갱신시간으로 제보가 모이고 있는지
              확인할 수 있습니다.
            </p>
          </div>

          <div className="mt-6 space-y-5">
            {stats.distribution.map((item) => (
              <div key={item.key}>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <span className="font-semibold">
                    {formatRefreshPattern(
                      item.hourType,
                      item.minute
                    )}
                  </span>

                  <span className="text-sm text-gray-400">
                    {item.count}표 · {item.percentage}%
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-lime-400"
                    style={{
                      width: `${item.percentage}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-4 rounded-2xl border border-white/10 bg-[#181b21] p-3 sm:mt-6 sm:p-6">
        <div>
          <p className="text-sm font-semibold text-lime-400">
            REPORTS
          </p>

          <h2 className="mt-1 text-2xl font-bold">
            최근 갱신 제보
          </h2>
        </div>

        {reports.length === 0 ? (
          <div className="mt-6 rounded-xl bg-white/[0.03] px-5 py-12 text-center text-sm text-gray-500">
            아직 등록된 제보가 없습니다.
          </div>
        ) : (
          <div className="mt-6 divide-y divide-white/10">
            {reports.slice(0, 10).map((report) => (
              <div
                key={report.id}
                className="flex items-center justify-between gap-4 py-4"
              >
                <div>
                  <p className="font-semibold">
                    {formatReport(report)}
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    유저 제보
                  </p>
                </div>

                <span className="whitespace-nowrap text-sm text-gray-500">
                  {formatDate(report.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
      </div>
    </>
  );
}

function InfoBox({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-white/[0.04] p-3 sm:p-5">
      <p className="text-[11px] text-gray-500 sm:text-sm">
        {title}
      </p>

      <p className="mt-1 break-words text-base font-bold leading-6 sm:mt-2 sm:text-xl">
        {value}
      </p>
    </div>
  );
}

function formatRefreshPattern(
  hourType: HourType,
  minute: number
) {
  if (hourType === "odd") {
    return `홀수 ${minute}분`;
  }

  if (hourType === "even") {
    return `짝수 ${minute}분`;
  }

  if (hourType === "every") {
    return `매시간 ${minute}분`;
  }

  return "미확인";
}

function formatObservation(observation: Observation) {
  const statusLabel =
    observation.source_status === "confirmed"
      ? "확인됨"
      : observation.source_status === "reported"
        ? "제보"
        : "추정";

  if (
    observation.observation_kind === "exact" ||
    (observation.start_hour_type === observation.end_hour_type &&
      observation.start_minute === observation.end_minute)
  ) {
    return `${formatRefreshPattern(
      observation.start_hour_type,
      observation.start_minute
    )} (${statusLabel})`;
  }

  const startHour =
    observation.start_hour_type === "odd" ? "홀수" : "짝수";
  const endHour =
    observation.end_hour_type === "odd" ? "홀수" : "짝수";

  if (observation.start_hour_type === observation.end_hour_type) {
    return `${startHour} ${observation.start_minute}분~${observation.end_minute}분 (${statusLabel})`;
  }

  return `${startHour} ${observation.start_minute}분~${endHour} ${observation.end_minute}분 (${statusLabel})`;
}

function formatReport(report: Report) {
  if (
    report.hour_type === "unknown" ||
    report.refresh_minute === null
  ) {
    return "갱신 패턴 미확인";
  }

  return formatRefreshPattern(
    report.hour_type,
    report.refresh_minute
  );
}

function formatDate(date: string) {
  return new Date(date).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getNextRefresh(
  hourType: HourType,
  minute: number,
  now: Date
) {
  const formatter = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "Asia/Seoul",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    }
  );

  const parts = formatter.formatToParts(now);

  const currentHour = Number(
    parts.find(
      (part) => part.type === "hour"
    )?.value ?? 0
  );

  const currentMinute = Number(
    parts.find(
      (part) => part.type === "minute"
    )?.value ?? 0
  );

  for (
    let hourOffset = 0;
    hourOffset <= 48;
    hourOffset++
  ) {
    const candidateHour =
      (currentHour + hourOffset) % 24;

    const matches =
      hourType === "every" ||
      (hourType === "odd" &&
        candidateHour % 2 === 1) ||
      (hourType === "even" &&
        candidateHour % 2 === 0);

    if (!matches) {
      continue;
    }

    const deltaMinutes =
      hourOffset * 60 +
      minute -
      currentMinute;

    if (deltaMinutes <= 0) {
      continue;
    }

    const candidate = new Date(
      now.getTime() +
        deltaMinutes * 60 * 1000
    );

    return candidate.toLocaleTimeString(
      "ko-KR",
      {
        timeZone: "Asia/Seoul",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    );
  }

  return "-";
}