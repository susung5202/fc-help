"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function PasswordRecoveryPage() {
  const supabase = useMemo(() => createClient(), []);
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    let recoveryEventSeen = false;

    function allowRecovery() {
      if (!active) return;
      recoveryEventSeen = true;
      setReady(true);
      setChecking(false);
      setMessage("");
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session?.user) {
        allowRecovery();
      }
    });

    const timer = window.setTimeout(() => {
      if (!active || recoveryEventSeen) return;
      setChecking(false);
    }, 5000);

    return () => {
      active = false;
      window.clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSuccess(false);

    if (!ready) {
      setMessage("비밀번호 재설정 인증이 필요합니다.");
      return;
    }
    if (password.length < 8) {
      setMessage("새 비밀번호는 8자 이상 입력해주세요.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("새 비밀번호와 확인 값이 일치하지 않습니다.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage(error.message || "비밀번호 변경에 실패했습니다.");
      setSaving(false);
      return;
    }
    await supabase.auth.signOut();

    setPassword("");
    setConfirmPassword("");
    setReady(false);
    setSuccess(true);
    setMessage("비밀번호를 변경했습니다. 새 비밀번호로 로그인해주세요.");
    setSaving(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f1115] px-4 py-10 text-white sm:px-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#181b21] p-6 sm:p-8">
        <Link href="/" className="text-2xl font-extrabold">
          FC <span className="text-lime-400">Help</span>
        </Link>

        <p className="mt-8 text-[10px] font-black tracking-[0.18em] text-lime-400">PASSWORD RECOVERY</p>
        <h1 className="mt-1 text-3xl font-black">비밀번호 재설정</h1>

        {checking ? (
          <p className="mt-8 rounded-xl border border-white/10 bg-black/20 px-4 py-5 text-sm text-gray-400">
            복구 링크를 확인하는 중...
          </p>
        ) : success ? (
          <div className="mt-6">
            <div className="rounded-xl border border-lime-300/20 bg-lime-300/5 px-4 py-4 text-sm leading-6 text-lime-100">
              {message}
            </div>
            <Link
              href="/login"
              className="mt-5 block w-full rounded-xl bg-lime-400 py-3 text-center font-black text-black transition hover:bg-lime-300"
            >
              로그인하기
            </Link>
          </div>
        ) : ready ? (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <p className="text-sm leading-6 text-gray-400">
              이메일 본인 확인이 완료되었습니다. 앞으로 사용할 새 비밀번호를 입력해주세요.
            </p>

            <div>
              <label htmlFor="newPassword" className="text-sm font-bold text-gray-400">새 비밀번호</label>
              <input
                id="newPassword"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                placeholder="8자 이상"
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 outline-none transition focus:border-lime-400"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="text-sm font-bold text-gray-400">새 비밀번호 확인</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                placeholder="한 번 더 입력"
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 outline-none transition focus:border-lime-400"
              />
            </div>

            {message && (
              <p className="rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-3 text-sm text-amber-100">
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-lime-400 py-3 font-black text-black transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "변경 중..." : "새 비밀번호 저장"}
            </button>
          </form>
        ) : (
          <div className="mt-6">
            <div className="rounded-xl border border-amber-300/20 bg-amber-300/5 px-4 py-4 text-sm leading-6 text-amber-100">
              유효한 비밀번호 재설정 링크를 확인하지 못했습니다. 링크가 만료됐거나 이미 사용된 경우 다시 요청해주세요.
            </div>
            <Link
              href="/recover"
              className="mt-5 block w-full rounded-xl bg-lime-400 py-3 text-center font-black text-black transition hover:bg-lime-300"
            >
              재설정 메일 다시 받기
            </Link>
          </div>
        )}

        <Link href="/login" className="mt-6 block text-center text-sm font-bold text-gray-500 transition hover:text-white">
          ← 로그인으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
