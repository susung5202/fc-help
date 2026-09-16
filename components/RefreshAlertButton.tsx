"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_ALERT_VOLUME,
  getStoredAlertVolume,
  playAlertSound,
  storeAlertVolume,
} from "@/lib/ui/alertSound";

type Props = {
  playerSpid: number;
  playerName: string;
  seasonName: string;
};

const ALERT_OPTIONS = [0, 1, 3, 5, 10];

export default function RefreshAlertButton({
  playerSpid,
  playerName,
  seasonName,
}: Props) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [minutesBefore, setMinutesBefore] = useState(3);
  const [registered, setRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [testLoading, setTestLoading] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_ALERT_VOLUME);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setVolume(getStoredAlertVolume());
  }, []);

  useEffect(() => {
    async function checkAlert() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setChecking(false);
        return;
      }

      const { data } = await supabase
        .from("refresh_alerts")
        .select("minutes_before, enabled")
        .eq("user_id", user.id)
        .eq("player_spid", playerSpid)
        .maybeSingle();

      if (data?.enabled) {
        setRegistered(true);
        setMinutesBefore(data.minutes_before);
      }

      setChecking(false);
    }

    checkAlert();
  }, [playerSpid]);

  async function handleOpen() {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setMessage("");
    setOpen(true);
  }

  async function handleSave() {
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLoading(false);
      router.push("/login");
      return;
    }

    const { error } = await supabase
      .from("refresh_alerts")
      .upsert(
        {
          user_id: user.id,
          player_spid: playerSpid,
          player_name: playerName,
          season_name: seasonName,
          minutes_before: minutesBefore,
          enabled: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,player_spid",
        }
      );

    if (error) {
      console.log("알림 등록 실패:", error.message);
      setMessage(`알림 등록 실패: ${error.message}`);
      setLoading(false);
      return;
    }

    setRegistered(true);
    setMessage("알림이 등록되었습니다.");
    setLoading(false);

    setTimeout(() => {
      setOpen(false);
      setMessage("");
    }, 700);
  }

  async function handleDelete() {
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      router.push("/login");
      return;
    }

    const { error } = await supabase
      .from("refresh_alerts")
      .delete()
      .eq("user_id", user.id)
      .eq("player_spid", playerSpid);

    if (error) {
      setMessage(`알림 해제 실패: ${error.message}`);
      setLoading(false);
      return;
    }

    setRegistered(false);
    setMessage("");
    setOpen(false);
    setLoading(false);
  }

  function handleVolumeChange(nextVolume: number) {
    const safeVolume = Math.min(100, Math.max(0, Math.round(nextVolume)));
    setVolume(safeVolume);
    storeAlertVolume(safeVolume);
  }

  async function handleSoundTest() {
    setMessage("");
    const played = await playAlertSound(volume);

    if (!played) {
      setMessage(
        volume === 0
          ? "알림음이 음소거 상태입니다."
          : "현재 브라우저에서 알림음을 재생하지 못했습니다."
      );
      return;
    }

    setMessage(`알림음 테스트 완료 · 음량 ${volume}%`);
  }

  async function handleNotificationTest() {
    setTestLoading(true);
    setMessage("");

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        return;
      }

      if (!("serviceWorker" in navigator)) {
        setMessage("현재 브라우저는 알림 기능을 지원하지 않습니다.");
        return;
      }

      if (!("PushManager" in window) || !("Notification" in window)) {
        setMessage("현재 브라우저는 Push 알림을 지원하지 않습니다.");
        return;
      }

      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        setMessage("브라우저 알림 권한을 허용해주세요.");
        return;
      }

      await navigator.serviceWorker.register("/sw.js");
      const registration = await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

        if (!publicKey) {
          setMessage("VAPID 공개키가 설정되지 않았습니다.");
          return;
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const json = subscription.toJSON();

      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setMessage("Push 구독 정보를 가져오지 못했습니다.");
        return;
      }

      const { error: saveError } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            endpoint: json.endpoint,
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "endpoint",
          }
        );

      if (saveError) {
        setMessage(`알림 정보 저장 실패: ${saveError.message}`);
        return;
      }

      await playAlertSound(volume);

      const response = await fetch("/api/push/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          title: "FC Help 갱신 알림 테스트",
          message: `${seasonName} ${playerName} · 실제 갱신 알림처럼 정상적으로 표시되는지 확인해주세요.`,
          url: `/refresh/${playerSpid}`,
          playSound: false,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "테스트 알림 발송에 실패했습니다.");
        return;
      }

      setMessage(`테스트 알림을 보냈습니다. · FC Help 음량 ${volume}%`);
    } catch (error) {
      console.log("Push 테스트 오류:", error);
      setMessage("테스트 알림 설정 중 오류가 발생했습니다.");
    } finally {
      setTestLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={checking}
        className={
          registered
            ? "rounded-xl border border-lime-400/30 bg-lime-400/10 px-5 py-3 text-sm font-bold text-lime-400 transition hover:bg-lime-400/15"
            : "rounded-xl bg-lime-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-lime-300"
        }
      >
        {checking
          ? "확인 중..."
          : registered
            ? `🔔 ${minutesBefore === 0 ? "갱신시간" : `${minutesBefore}분 전`} 알림 중`
            : "🔔 갱신 알림 받기"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-[#181b21] p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-lime-400">
                  REFRESH ALERT
                </p>

                <h2 className="mt-1 text-2xl font-bold">
                  갱신시간 알림
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-2xl text-gray-500 transition hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="mt-6 rounded-xl bg-white/5 p-4">
              <p className="text-sm text-gray-500">
                {seasonName}
              </p>

              <p className="mt-1 font-bold">
                {playerName}
              </p>
            </div>

            <div className="mt-6">
              <p className="text-sm font-semibold">
                언제 알려드릴까요?
              </p>

              <div className="mt-3 grid grid-cols-2 gap-3">
                {ALERT_OPTIONS.map((minutes) => {
                  const selected = minutesBefore === minutes;

                  return (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => setMinutesBefore(minutes)}
                      className={
                        selected
                          ? "rounded-xl border border-lime-400 bg-lime-400/10 px-4 py-3 text-sm font-semibold text-lime-400"
                          : "rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-sm font-semibold text-gray-400 transition hover:border-white/30"
                      }
                    >
                      {minutes === 0
                        ? "갱신시간"
                        : `${minutes}분 전`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-[#101217] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">알림음</p>
                  <p className="mt-1 text-xs text-gray-500">
                    FC Help가 열려 있을 때 재생되는 소리
                  </p>
                </div>
                <span className="text-sm font-bold text-lime-300">
                  {volume === 0 ? "음소거" : `${volume}%`}
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={volume}
                onChange={(event) =>
                  handleVolumeChange(Number(event.target.value))
                }
                aria-label="FC Help 알림음 음량"
                className="mt-4 w-full accent-lime-400"
              />

              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleSoundTest}
                  className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:border-white/30 hover:bg-white/[0.04]"
                >
                  🔊 소리 테스트
                </button>
                <button
                  type="button"
                  onClick={handleNotificationTest}
                  disabled={testLoading}
                  className="rounded-xl border border-lime-400/30 bg-lime-400/10 px-4 py-3 text-sm font-semibold text-lime-300 transition hover:bg-lime-400/15 disabled:opacity-50"
                >
                  {testLoading ? "발송 중..." : "🔔 알림 테스트"}
                </button>
              </div>

              <p className="mt-3 text-[11px] leading-5 text-gray-600">
                이 음량은 FC Help의 자체 알림음에 적용됩니다. 휴대폰·PC의 시스템 Push 알림 소리는 기기 알림/미디어 음량 설정을 따릅니다.
              </p>
            </div>

            {message && (
              <p className="mt-5 rounded-xl bg-white/5 px-4 py-3 text-sm text-yellow-300">
                {message}
              </p>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="mt-6 w-full rounded-xl bg-lime-400 py-3 font-bold text-black transition hover:bg-lime-300 disabled:opacity-50"
            >
              {loading
                ? "저장 중..."
                : registered
                  ? "알림 설정 변경"
                  : "알림 등록"}
            </button>

            {registered && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="mt-3 w-full rounded-xl border border-red-400/20 py-3 text-sm font-semibold text-red-300 transition hover:bg-red-400/5 disabled:opacity-50"
              >
                알림 해제
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);

  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
