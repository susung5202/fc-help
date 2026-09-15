import webpush from "web-push";
import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

type HourType =
  | "odd"
  | "even"
  | "every"
  | "unknown";

type RefreshReport = {
  player_spid: number;
  hour_type: HourType;
  refresh_minute: number | null;
};

type Alert = {
  id: number;
  user_id: string;
  player_spid: number;

  player_name: string | null;
  season_name: string | null;

  minutes_before: number;
  enabled: boolean;
};

type PushSubscriptionRow = {
  id: number;
  user_id: string;

  endpoint: string;
  p256dh: string;
  auth: string;
};

type Pattern = {
  hourType: HourType;
  minute: number;
  count: number;
};

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function GET(
  request: Request
) {
  try {
    /*
     * 외부에서 아무나 이 API를 실행하지 못하도록 보호
     */
    const authorization =
      request.headers.get("authorization");

    const cronSecret =
      process.env.CRON_SECRET;

    if (
      !cronSecret ||
      authorization !== `Bearer ${cronSecret}`
    ) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const supabase =
      createAdminClient();

    const now = new Date();

    /*
     * 현재 활성화된 모든 갱신 알림
     */
    const {
      data: alertsData,
      error: alertsError,
    } = await supabase
      .from("refresh_alerts")
      .select(
        `
        id,
        user_id,
        player_spid,
        player_name,
        season_name,
        minutes_before,
        enabled
        `
      )
      .eq("enabled", true);

    if (alertsError) {
      throw alertsError;
    }

    const alerts =
      (alertsData ?? []) as Alert[];

    if (alerts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "등록된 알림 없음",
        sent: 0,
      });
    }

    /*
     * 중복 SPID 제거
     */
    const playerSpids = [
      ...new Set(
        alerts.map(
          (alert) =>
            alert.player_spid
        )
      ),
    ];

    /*
     * 알림 대상 선수들의 갱신 제보 가져오기
     */
    const {
      data: reportsData,
      error: reportsError,
    } = await supabase
      .from("refresh_reports")
      .select(
        `
        player_spid,
        hour_type,
        refresh_minute
        `
      )
      .in(
        "player_spid",
        playerSpids
      );

    if (reportsError) {
      throw reportsError;
    }

    const reports =
      (reportsData ?? []) as RefreshReport[];

    /*
     * 선수별 대표 갱신 패턴 계산
     */
    const patternMap =
      buildPatternMap(
        reports
      );

    let sentCount = 0;

    /*
     * 각 알림 검사
     */
    for (const alert of alerts) {
      const pattern =
        patternMap.get(
          alert.player_spid
        );

      /*
       * 대표 패턴이 없거나
       * 의견이 동률이면 알림 발송 X
       */
      if (!pattern) {
        continue;
      }

      /*
       * 지금이 실제 알림을 보내야 하는
       * 1분 구간인지 확인
       */
      const refreshAt =
        findDueRefreshAt({
          hourType:
            pattern.hourType,

          minute:
            pattern.minute,

          minutesBefore:
            alert.minutes_before,

          now,
        });

      if (!refreshAt) {
        continue;
      }

      /*
       * 이미 보낸 알림인지 검사
       */
      const {
        data: existingLog,
      } = await supabase
        .from(
          "notification_logs"
        )
        .select("id")
        .eq(
          "user_id",
          alert.user_id
        )
        .eq(
          "player_spid",
          alert.player_spid
        )
        .eq(
          "refresh_at",
          refreshAt.toISOString()
        )
        .eq(
          "minutes_before",
          alert.minutes_before
        )
        .maybeSingle();

      if (existingLog) {
        continue;
      }

      /*
       * 해당 사용자의 모든 브라우저/기기
       */
      const {
        data: subscriptionsData,
        error:
          subscriptionsError,
      } = await supabase
        .from(
          "push_subscriptions"
        )
        .select(
          `
          id,
          user_id,
          endpoint,
          p256dh,
          auth
          `
        )
        .eq(
          "user_id",
          alert.user_id
        );

      if (
        subscriptionsError
      ) {
        console.log(
          "Push 구독 조회 실패:",
          subscriptionsError.message
        );

        continue;
      }

      const subscriptions =
        (subscriptionsData ??
          []) as PushSubscriptionRow[];

      if (
        subscriptions.length === 0
      ) {
        continue;
      }

      const playerLabel =
        [
          alert.season_name,
          alert.player_name,
        ]
          .filter(Boolean)
          .join(" ");

      const refreshTime =
        formatKoreanTime(
          refreshAt
        );

      const body =
        alert.minutes_before === 0
          ? `예상 갱신시간입니다. (${refreshTime})`
          : `예상 갱신시간이 ${alert.minutes_before}분 남았습니다. (${refreshTime})`;

      let successCount = 0;

      /*
       * 사용자의 모든 등록 기기에 전송
       */
      for (
        const subscription
        of subscriptions
      ) {
        try {
          await webpush.sendNotification(
            {
              endpoint:
                subscription.endpoint,

              keys: {
                p256dh:
                  subscription.p256dh,

                auth:
                  subscription.auth,
              },
            },

            JSON.stringify({
              title:
                playerLabel ||
                "FC Help 갱신 알림",

              body,

              url:
                `/players/${alert.player_spid}`,
            })
          );

          successCount += 1;
        } catch (error) {
          const pushError =
            error as {
              statusCode?: number;
              message?: string;
            };

          console.log(
            "Push 발송 실패:",
            pushError.message
          );

          /*
           * 만료된 Push 구독은 자동 제거
           */
          if (
            pushError.statusCode ===
              404 ||
            pushError.statusCode ===
              410
          ) {
            await supabase
              .from(
                "push_subscriptions"
              )
              .delete()
              .eq(
                "id",
                subscription.id
              );
          }
        }
      }

      /*
       * 하나 이상의 기기에 성공했을 때만
       * 발송 기록 저장
       */
      if (successCount > 0) {
        const {
          error: logError,
        } = await supabase
          .from(
            "notification_logs"
          )
          .insert({
            user_id:
              alert.user_id,

            player_spid:
              alert.player_spid,

            refresh_at:
              refreshAt.toISOString(),

            minutes_before:
              alert.minutes_before,
          });

        if (!logError) {
          sentCount += 1;
        }
      }
    }

    return NextResponse.json({
      success: true,

      checkedAlerts:
        alerts.length,

      sent:
        sentCount,

      checkedAt:
        now.toISOString(),
    });
  } catch (error) {
    console.log(
      "자동 갱신 알림 오류:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "자동 알림 처리 중 오류가 발생했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}

/*
 * 선수별 최빈 갱신시간 계산
 *
 * 동률이면 null 처리해서
 * 자동 알림을 보내지 않는다.
 */
function buildPatternMap(
  reports: RefreshReport[]
) {
  const grouped =
    new Map<
      number,
      RefreshReport[]
    >();

  for (const report of reports) {
    if (
      report.hour_type ===
        "unknown" ||
      report.refresh_minute ===
        null
    ) {
      continue;
    }

    const current =
      grouped.get(
        report.player_spid
      ) ?? [];

    current.push(report);

    grouped.set(
      report.player_spid,
      current
    );
  }

  const result =
    new Map<
      number,
      Pattern
    >();

  for (
    const [
      playerSpid,
      playerReports,
    ] of grouped
  ) {
    const counts =
      new Map<
        string,
        Pattern
      >();

    for (
      const report
      of playerReports
    ) {
      if (
        report.refresh_minute ===
        null
      ) {
        continue;
      }

      const key =
        `${report.hour_type}-${report.refresh_minute}`;

      const current =
        counts.get(key);

      if (current) {
        current.count += 1;
      } else {
        counts.set(
          key,
          {
            hourType:
              report.hour_type,

            minute:
              report.refresh_minute,

            count: 1,
          }
        );
      }
    }

    const patterns =
      Array.from(
        counts.values()
      ).sort(
        (a, b) =>
          b.count -
          a.count
      );

    if (
      patterns.length === 0
    ) {
      continue;
    }

    /*
     * 1위와 2위 표가 같으면 의견 갈림
     */
    if (
      patterns.length > 1 &&
      patterns[0].count ===
        patterns[1].count
    ) {
      continue;
    }

    result.set(
      playerSpid,
      patterns[0]
    );
  }

  return result;
}

function findDueRefreshAt({
  hourType,
  minute,
  minutesBefore,
  now,
}: {
  hourType: HourType;
  minute: number;
  minutesBefore: number;
  now: Date;
}) {
  /*
   * KST = UTC + 9시간
   * 한국은 DST가 없으므로 이 방식으로 안전하게 계산 가능
   */
  const KST_OFFSET =
    9 * 60 * 60 * 1000;

  const kstNow =
    new Date(
      now.getTime() +
        KST_OFFSET
    );

  const year =
    kstNow.getUTCFullYear();

  const month =
    kstNow.getUTCMonth();

  const day =
    kstNow.getUTCDate();

  const hour =
    kstNow.getUTCHours();

  /*
   * 앞으로 최대 48시간 검사
   */
  for (
    let offset = 0;
    offset <= 48;
    offset++
  ) {
    /*
     * KST 기준 후보 시간
     */
    const candidateKst =
      new Date(
        Date.UTC(
          year,
          month,
          day,
          hour + offset,
          minute,
          0,
          0
        )
      );

    const candidateHour =
      candidateKst.getUTCHours();

    const matches =
      hourType === "every" ||
      (
        hourType === "odd" &&
        candidateHour % 2 === 1
      ) ||
      (
        hourType === "even" &&
        candidateHour % 2 === 0
      );

    if (!matches) {
      continue;
    }

    /*
     * KST → 실제 UTC
     */
    const refreshAt =
      new Date(
        candidateKst.getTime() -
          KST_OFFSET
      );

    /*
     * 알림을 보내야 하는 시간
     */
    const sendAt =
      new Date(
        refreshAt.getTime() -
          minutesBefore *
            60 *
            1000
      );

    /*
     * 현재 시간이 해당 1분 구간 안이면 발송
     *
     * 예:
     * sendAt 15:50:00
     *
     * 15:50:00 ~ 15:50:59
     * 사이에 실행되면 전송
     */
    if (
      now.getTime() >=
        sendAt.getTime() &&
      now.getTime() <
        sendAt.getTime() +
          60 * 1000
    ) {
      return refreshAt;
    }
  }

  return null;
}

function formatKoreanTime(
  date: Date
) {
  return date.toLocaleTimeString(
    "ko-KR",
    {
      timeZone:
        "Asia/Seoul",

      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  );
}