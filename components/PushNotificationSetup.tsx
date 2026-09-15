"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PushNotificationSetup() {
  const router = useRouter();

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function enableNotifications() {
    setLoading(true);
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
        setMessage(
          "현재 브라우저는 알림 기능을 지원하지 않습니다."
        );
        return;
      }

      if (!("PushManager" in window)) {
        setMessage(
          "현재 브라우저는 Push 알림을 지원하지 않습니다."
        );
        return;
      }

      const permission =
        await Notification.requestPermission();

      if (permission !== "granted") {
        setMessage(
          "브라우저 알림 권한을 허용해주세요."
        );
        return;
      }

      const registration =
        await navigator.serviceWorker.register(
          "/sw.js"
        );

      await navigator.serviceWorker.ready;

      let subscription =
        await registration.pushManager.getSubscription();

      if (!subscription) {
        const publicKey =
          process.env
            .NEXT_PUBLIC_VAPID_PUBLIC_KEY;

        if (!publicKey) {
          setMessage(
            "VAPID 공개키가 설정되지 않았습니다."
          );
          return;
        }

        subscription =
          await registration.pushManager.subscribe(
            {
              userVisibleOnly: true,

              applicationServerKey:
                urlBase64ToUint8Array(
                  publicKey
                ),
            }
          );
      }

      const json = subscription.toJSON();

      if (
        !json.endpoint ||
        !json.keys?.p256dh ||
        !json.keys?.auth
      ) {
        setMessage(
          "Push 구독 정보를 가져오지 못했습니다."
        );
        return;
      }

      const { error: saveError } =
        await supabase
          .from("push_subscriptions")
          .upsert(
            {
              user_id: user.id,

              endpoint: json.endpoint,

              p256dh: json.keys.p256dh,

              auth: json.keys.auth,

              updated_at:
                new Date().toISOString(),
            },
            {
              onConflict: "endpoint",
            }
          );

      if (saveError) {
        setMessage(
          `알림 정보 저장 실패: ${saveError.message}`
        );
        return;
      }

      const response = await fetch(
        "/api/push/test",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            subscription:
              subscription.toJSON(),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage(
          result.error ??
            "테스트 알림 발송에 실패했습니다."
        );
        return;
      }

      setMessage(
        "브라우저 알림이 활성화되었습니다."
      );
    } catch (error) {
      console.log(
        "Push 설정 오류:",
        error
      );

      setMessage(
        "알림 설정 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={enableNotifications}
        disabled={loading}
        className="rounded-xl bg-lime-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-lime-300 disabled:opacity-50"
      >
        {loading
          ? "설정 중..."
          : "브라우저 알림 활성화"}
      </button>

      {message && (
        <p className="mt-3 text-sm text-gray-400">
          {message}
        </p>
      )}
    </div>
  );
}

function urlBase64ToUint8Array(
  base64String: string
) {
  const padding =
    "=".repeat(
      (4 -
        (base64String.length % 4)) %
        4
    );

  const base64 = (
    base64String + padding
  )
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData =
    window.atob(base64);

  return Uint8Array.from(
    [...rawData].map((char) =>
      char.charCodeAt(0)
    )
  );
}