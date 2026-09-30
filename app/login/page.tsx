"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

const LOGIN_ID_PATTERN = /^[a-z0-9_]{3,20}$/;

function authErrorMessage(message: string, mode: AuthMode) {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "아이디 또는 이메일, 혹은 비밀번호가 맞지 않습니다.";
  }
  if (normalized.includes("email not confirmed")) {
    return "이메일 인증이 아직 완료되지 않았습니다. 받은 편지함의 인증 메일을 확인해주세요.";
  }
  if (normalized.includes("user already registered")) {
    return "이미 가입된 이메일입니다. 로그인 탭에서 로그인해주세요.";
  }
  if (normalized.includes("database error saving new user")) {
    return "회원가입 정보를 저장하지 못했습니다. 로그인 아이디가 이미 사용 중인지 확인해주세요.";
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
  const [loginId, setLoginId] = useState("");
  const [email, setEmail] = useState("");
  const [fcNickname, setFcNickname] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
    setSuccess(false);
    setPassword("");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const normalizedLoginId = loginId.trim().toLowerCase();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFcNickname = fcNickname.trim();

    if (!normalizedLoginId || !password) {
      setSuccess(false);
      setMessage(mode === "login" ? "아이디 또는 이메일과 비밀번호를 입력해주세요." : "로그인 아이디와 비밀번호를 입력해주세요.");
      return;
    }

    if (mode === "signup" && (!normalizedEmail || !normalizedFcNickname)) {
      setSuccess(false);
      setMessage("이메일, 로그인 아이디, FC Online 닉네임, 비밀번호를 모두 입력해주세요.");
      return;
    }

    setLoading(true);
    setMessage("");
    setSuccess(false);

    if (mode === "signup") {
      if (!LOGIN_ID_PATTERN.test(normalizedLoginId)) {
        setMessage("로그인 아이디는 영문 소문자, 숫자, 밑줄(_)만 사용해 3~20자로 입력해주세요.");
        setLoading(false);
        return;
      }

      if (normalizedFcNickname.length > 20) {
        setMessage("FC Online 닉네임은 20자 이하로 입력해주세요.");
        setLoading(false);
        return;
      }

      try {
        const checkResponse = await fetch("/api/auth/login-id", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ loginId: normalizedLoginId }),
        });
        const checkPayload = (await checkResponse.json()) as { available?: boolean; valid?: boolean; error?: string };
        if (!checkResponse.ok) throw new Error(checkPayload.error || "아이디 확인에 실패했습니다.");
        if (!checkPayload.valid) {
          setMessage("로그인 아이디는 영문 소문자, 숫자, 밑줄(_)만 사용해 3~20자로 입력해주세요.");
          setLoading(false);
          return;
        }
        if (!checkPayload.available) {
          setMessage("이미 사용 중인 로그인 아이디입니다.");
          setLoading(false);
          return;
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "아이디 확인에 실패했습니다.");
        setLoading(false);
        return;
      }

      try {
        const signupResponse = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: normalizedEmail,
            loginId: normalizedLoginId,
            fcNickname: normalizedFcNickname,
            password,
          }),
        });
        const signupPayload = (await signupResponse.json()) as {
          nickname?: string;
          ouid?: string;
          emailConfirmationRequired?: boolean;
          access_token?: string | null;
          refresh_token?: string | null;
          error?: string;
        };

        if (!signupResponse.ok) {
          setMessage(signupPayload.error || "회원가입에 실패했습니다.");
          setLoading(false);
          return;
        }

        if (signupPayload.access_token && signupPayload.refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: signupPayload.access_token,
            refresh_token: signupPayload.refresh_token,
          });
          if (sessionError) {
            setMessage(authErrorMessage(sessionError.message, mode));
            setLoading(false);
            return;
          }

          router.push("/mypage");
          router.refresh();
          return;
        }

        setSuccess(true);
        setMessage(`FC Online '${signupPayload.nickname ?? normalizedFcNickname}' 구단주를 확인했습니다. 이메일 인증 후 로그인해주세요.`);
        setMode("login");
        setPassword("");
        setFcNickname("");
        setLoading(false);
        return;
      } catch {
        setMessage("회원가입 처리 중 오류가 발생했습니다.");
        setLoading(false);
        return;
      }
    }

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: normalizedLoginId, password }),
      });
      const payload = (await response.json()) as { access_token?: string; refresh_token?: string; error?: string };

      if (!response.ok || !payload.access_token || !payload.refresh_token) {
        setMessage(payload.error || "아이디 또는 이메일, 혹은 비밀번호가 맞지 않습니다.");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
      });
      if (error) {
        setMessage(authErrorMessage(error.message, mode));
        setLoading(false);
        return;
      }
    } catch {
      setMessage("로그인 처리 중 오류가 발생했습니다.");
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
            ? "로그인 아이디 또는 가입한 이메일과 비밀번호를 입력해주세요."
            : "이메일, 로그인 아이디, FC Online 닉네임을 각각 따로 등록합니다."}
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
            <label htmlFor="loginId" className="text-sm text-gray-400">
              {mode === "login" ? "아이디 또는 이메일" : "로그인 아이디"}
            </label>
            <input
              id="loginId"
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value.toLowerCase())}
              placeholder={mode === "login" ? "아이디 또는 example@email.com" : "fchelp123"}
              autoComplete="username"
              maxLength={mode === "signup" ? 20 : 254}
              required
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-white outline-none transition focus:border-lime-400"
            />
            {mode === "signup" ? (
              <p className="mt-1 text-[11px] text-gray-600">영문 소문자, 숫자, 밑줄(_) · 3~20자 · 로그인 전용</p>
            ) : (
              <p className="mt-1 text-[11px] text-gray-600">로그인 아이디와 가입 이메일 중 편한 것으로 로그인할 수 있습니다.</p>
            )}
          </div>

          {mode === "signup" && (
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
              <p className="mt-1 text-[11px] text-gray-600">이메일 인증과 계정 복구에 사용됩니다.</p>
            </div>
          )}

          {mode === "signup" && (
            <div>
              <label htmlFor="fcNickname" className="text-sm text-gray-400">FC Online 닉네임</label>
              <input
                id="fcNickname"
                type="text"
                value={fcNickname}
                onChange={(e) => setFcNickname(e.target.value)}
                placeholder="게임에서 사용하는 구단주 닉네임"
                autoComplete="nickname"
                maxLength={20}
                required
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-white outline-none transition focus:border-lime-400"
              />
              <p className="mt-1 text-[11px] text-gray-600">FC Help에서 표시되는 닉네임이자 FC Online 연동에 사용됩니다.</p>
            </div>
          )}

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
