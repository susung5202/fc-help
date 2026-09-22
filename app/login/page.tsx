"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

function authErrorMessage(message: string, mode: AuthMode) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "이메일 또는 비밀번호가 맞지 않습니다. 처음 가입하는 계정이라면 회원가입 탭에서 가입해주세요.";
  }
  if (normalized.includes("email not confirmed")) {
    return "이메일 인증이 아직 완료되지 않았습니다. 받은 편지함의 인증 메일을 확인해주세요.";
  }
  if (normalized.includes("user already registered")) {
    return "이미 가입된 이메일입니다. 로그인 탭에서 로그인해주세요.";
  }
  if (normalized.includes("password") && normalized.includes("characters")) {
    return "비밀번호는 6자 이상 입력해주세요.";
  }

  return mode === "signup" ? `회원가입 실패: ${message}` : `로그인 실패: ${message}`;
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
    setSuccess(false);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setSuccess(false);
      setMessage("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setLoading(true);
    setMessage("");
    setSuccess(false);

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) {
        setMessage(authErrorMessage(error.message, mode));
        setLoading(false);
        return;
      }

      if (data.session) {
        router.push("/mypage");
        router.refresh();
        return;
      }

      setSuccess(true);
      setMessage("회원가입 요청이 완료되었습니다. 이메일로 보낸 인증 링크를 누른 뒤 로그인해주세요. 스팸함도 확인해주세요.");
      setMode("login");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      setMessage(authErrorMessage(error.message, mode));
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f1115] px-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#181b21] p-8">
        <Link href="/" className="text-2xl font-extrabold">
          FC <span className="text-lime-400">Help</span>
        </Link>

        <h1 className="mt-8 text-3xl font-bold">{mode === "login" ? "로그인" : "회원가입"}</h1>

        <p className="mt-2 text-sm text-gray-400">
          {mode === "login"
            ? "FC Help 계정으로 로그인하면 스쿼드 공유와 커뮤니티 기능을 이용할 수 있습니다."
            : "이메일과 비밀번호로 FC Help 계정을 만듭니다. 이메일 인증이 필요할 수 있습니다."}
        </p>

        <div className="mt-6 grid grid-cols-2 rounded-xl border border-white/10 bg-[#0f1115] p-1">
          <button
            type="button"
            onClick={() => changeMode("login")}
            className={`rounded-lg py-2.5 text-sm font-bold transition ${mode === "login" ? "bg-white text-black" : "text-gray-400 hover:text-white"}`}
          >
            로그인
          </button>
          <button
            type="button"
            onClick={() => changeMode("signup")}
            className={`rounded-lg py-2.5 text-sm font-bold transition ${mode === "signup" ? "bg-lime-400 text-black" : "text-gray-400 hover:text-white"}`}
          >
            회원가입
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="text-sm text-gray-400">이메일</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              autoComplete="email"
              required
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-white outline-none transition focus:border-lime-400"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-sm text-gray-400">비밀번호</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상 비밀번호"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={6}
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-white outline-none transition focus:border-lime-400"
            />
          </div>

          {message && (
            <p className={`rounded-lg px-3 py-2 text-sm ${success ? "bg-lime-400/10 text-lime-200" : "bg-amber-300/10 text-amber-200"}`}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-lime-400 py-3 font-bold text-black transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "처리 중..." : mode === "login" ? "로그인" : "회원가입"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-500">
          {mode === "login" ? "처음이신가요? " : "이미 계정이 있나요? "}
          <button
            type="button"
            onClick={() => changeMode(mode === "login" ? "signup" : "login")}
            className="font-bold text-lime-300 hover:text-lime-200"
          >
            {mode === "login" ? "회원가입" : "로그인"}
          </button>
        </p>

        <Link href="/" className="mt-6 block text-center text-sm text-gray-500 transition hover:text-white">
          ← FC Help로 돌아가기
        </Link>
      </div>
    </main>
  );
}
