"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";

type RecoveryMode = "find-id" | "reset-password";

export default function RecoveryPage() {
  const [mode, setMode] = useState<RecoveryMode>("find-id");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function changeMode(nextMode: RecoveryMode) {
    setMode(nextMode);
    setMessage("");
    setSuccess(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setSuccess(false);
      setMessage("가입할 때 사용한 이메일을 입력해주세요.");
      return;
    }

    setLoading(true);
    setMessage("");
    setSuccess(false);

    try {
      const res = await fetch("/api/auth/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, email: normalizedEmail }),
      });
      const payload = (await res.json()) as { ok?: boolean; message?: string };

      if (!res.ok) {
        setMessage(payload.message || "계정 복구 요청을 처리하지 못했습니다.");
        setLoading(false);
        return;
      }

      try {
        localStorage.setItem(
          mode === "find-id" ? "fchelp-find-id-requested" : "fchelp-password-recovery-requested",
          "1"
        );
      } catch {}

      setSuccess(true);
      setMessage(
        payload.message ||
          (mode === "find-id"
            ? "가입된 이메일이라면 아이디 확인 링크를 보내드렸습니다."
            : "가입된 이메일이라면 비밀번호 재설정 링크를 보내드렸습니다.")
      );
    } catch {
      setMessage("계정 복구 요청 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f1115] px-4 py-10 text-white sm:px-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#181b21] p-6 sm:p-8">
        <Link href="/" className="text-2xl font-extrabold">
          FC <span className="text-lime-400">Help</span>
        </Link>

        <p className="mt-8 text-[10px] font-black tracking-[0.18em] text-lime-400">ACCOUNT RECOVERY</p>
        <h1 className="mt-1 text-3xl font-black">계정 찾기</h1>
        <p className="mt-2 text-sm leading-6 text-gray-400">
          가입한 이메일로 본인 확인 후 로그인 아이디를 확인하거나 비밀번호를 새로 설정할 수 있습니다.
        </p>

        <div className="mt-6 grid grid-cols-2 rounded-xl border border-white/10 bg-[#0f1115] p-1">
          <button
            type="button"
            onClick={() => changeMode("find-id")}
            className={`rounded-lg py-2.5 text-sm font-black transition ${
              mode === "find-id" ? "bg-white text-black" : "text-gray-500 hover:text-white"
            }`}
          >
            아이디 찾기
          </button>
          <button
            type="button"
            onClick={() => changeMode("reset-password")}
            className={`rounded-lg py-2.5 text-sm font-black transition ${
              mode === "reset-password" ? "bg-lime-400 text-black" : "text-gray-500 hover:text-white"
            }`}
          >
            비밀번호 재설정
          </button>
        </div>

        <form onSubmit={submit} className="mt-6">
          <label htmlFor="recoveryEmail" className="text-sm font-bold text-gray-400">
            가입 이메일
          </label>
          <input
            id="recoveryEmail"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="example@email.com"
            autoComplete="email"
            required
            maxLength={254}
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-white outline-none transition focus:border-lime-400"
          />

          <p className="mt-2 text-[11px] leading-5 text-gray-600">
            보안을 위해 해당 이메일의 가입 여부는 화면에서 따로 알려드리지 않습니다.
          </p>

          {message && (
            <div
              className={`mt-4 rounded-xl border px-4 py-3 text-sm leading-6 ${
                success
                  ? "border-lime-300/20 bg-lime-300/5 text-lime-100"
                  : "border-amber-300/20 bg-amber-300/5 text-amber-100"
              }`}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 w-full rounded-xl bg-lime-400 py-3 font-black text-black transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "처리 중..."
              : mode === "find-id"
                ? "아이디 확인 메일 받기"
                : "비밀번호 재설정 메일 받기"}
          </button>
        </form>

        <div className="mt-6 border-t border-white/10 pt-5 text-center">
          <Link href="/login" className="text-sm font-bold text-gray-400 transition hover:text-white">
            ← 로그인으로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}
