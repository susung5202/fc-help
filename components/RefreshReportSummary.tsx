"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveRefreshPattern, type RefreshReferencePatternRow } from "@/lib/refresh/resolvePattern";

type HourType = "odd" | "even" | "every" | "unknown";

type Report = {
  id: number;
  hour_type: HourType;
  refresh_minute: number | null;
  created_at: string;
};

type Props = {
  playerSpid: number;
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
}: Props) {
  const [reports, setReports] = useState<Report[]>([]);
  const [reference, setReference] = useState<Reference | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    async function loadReports() {
      const supabase = createClient();

      const [
        { data: reportData, error: reportError },
        { data: referenceData, error: referenceError },
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
      ]);

      if (reportError || referenceError) {
        console.log(
          "갱신시간 정보 불러오기 실패:",
          reportError?.message || referenceError?.message
        );
        setLoading(false);
        return;
      }

      setReports((reportData ?? []) as Report[]);
      setReference((referenceData as Reference | null) ?? null);
      setLoading(false);
    }

    loadReports();
  }, [playerSpid]);

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
            }
          : null
      ),
    [reports, reference]
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
      <section className="mt-12 rounded-2xl border border-white/10 bg-[#181b21] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-lime-400">
              REFRESH TIME
            </p>

            <h2 className="mt-1 text-2xl font-bold">
              갱신시간
            </h2>
          </div>
        </div>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">
          여기에서 표시하는 갱신시간은 2시간 거래량이 갱신되는 기준 시각입니다.
          기준가·상한가·하한가는 이 시각 이후 약 0~20분 사이에 변동될 수 있습니다.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      {stats && (
        <section className="mt-6 rounded-2xl border border-white/10 bg-[#181b21] p-6">
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

      <section className="mt-6 rounded-2xl border border-white/10 bg-[#181b21] p-6">
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
    <div className="rounded-xl bg-white/[0.04] p-5">
      <p className="text-sm text-gray-500">
        {title}
      </p>

      <p className="mt-2 text-xl font-bold">
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