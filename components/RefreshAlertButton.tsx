"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  const [message, setMessage] = useState("");

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
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#181b21] p-6 shadow-2xl">
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
                  const selected =
                    minutesBefore === minutes;

                  return (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() =>
                        setMinutesBefore(minutes)
                      }
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