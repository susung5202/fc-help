"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type RefreshReportButtonProps = {
  playerSpid: number;
  playerName: string;
  seasonName: string;
};

export default function RefreshReportButton({
  playerSpid,
  playerName,
  seasonName,
}: RefreshReportButtonProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [hourType, setHourType] = useState("odd");
  const [minute, setMinute] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const refreshMinute = Number(minute);

    if (
      minute === "" ||
      Number.isNaN(refreshMinute) ||
      refreshMinute < 0 ||
      refreshMinute > 59
    ) {
      setMessage("갱신 분은 0~59 사이로 입력해주세요.");
      return;
    }

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
      .from("refresh_reports")
      .upsert(
        {
          player_spid: playerSpid,
          player_name: playerName,
          season_name: seasonName,
          hour_type: hourType,
          refresh_minute: refreshMinute,
          observed_at: new Date().toISOString(),
          user_id: user.id,
        },
        {
          onConflict: "user_id,player_spid",
        }
      );

    if (error) {
        console.log("제보 저장 오류:", {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
        });

        setMessage(
            `제보 저장 실패: ${error.message || "알 수 없는 오류"}`
        );

        setLoading(false);
        return;
    }

    setMessage("제보가 등록되었습니다.");
    setLoading(false);

    setTimeout(() => {
      setOpen(false);
      setMinute("");
      setMessage("");
      router.refresh();
    }, 800);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-white/10 bg-[#181b21] px-5 py-3 text-sm font-semibold transition hover:border-white/30"
      >
        갱신시간 제보
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#181b21] p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-lime-400">
                  REFRESH REPORT
                </p>

                <h2 className="mt-1 text-2xl font-bold">
                  갱신시간 제보
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

            <form
              onSubmit={handleSubmit}
              className="mt-6 space-y-6"
            >
              <div>
                <p className="mb-3 text-sm font-semibold">
                  갱신 패턴
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <PatternButton
                    selected={hourType === "odd"}
                    onClick={() => setHourType("odd")}
                  >
                    홀수 시간
                  </PatternButton>

                  <PatternButton
                    selected={hourType === "even"}
                    onClick={() => setHourType("even")}
                  >
                    짝수 시간
                  </PatternButton>

                  <PatternButton
                    selected={hourType === "every"}
                    onClick={() => setHourType("every")}
                  >
                    매시간
                  </PatternButton>

                  <PatternButton
                    selected={hourType === "unknown"}
                    onClick={() => setHourType("unknown")}
                  >
                    잘 모르겠음
                  </PatternButton>
                </div>
              </div>

              <div>
                <label
                  htmlFor="refresh-minute"
                  className="text-sm font-semibold"
                >
                  갱신 분
                </label>

                <div className="mt-3 flex items-center rounded-xl border border-white/10 bg-[#0f1115] px-4">
                  <input
                    id="refresh-minute"
                    type="number"
                    min="0"
                    max="59"
                    value={minute}
                    onChange={(e) => setMinute(e.target.value)}
                    placeholder="53"
                    required
                    className="w-full bg-transparent py-3 text-white outline-none"
                  />

                  <span className="text-sm text-gray-500">
                    분
                  </span>
                </div>
              </div>

              {message && (
                <p className="rounded-xl bg-white/5 px-4 py-3 text-sm text-yellow-300">
                  {message}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-lime-400 py-3 font-bold text-black transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "등록 중..." : "제보하기"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function PatternButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
        selected
          ? "border-lime-400 bg-lime-400/10 text-lime-400"
          : "border-white/10 bg-[#0f1115] text-gray-400 hover:border-white/30"
      }`}
    >
      {children}
    </button>
  );
}