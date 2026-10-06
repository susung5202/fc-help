"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function FindIdResultPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loginId, setLoginId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let resolved = false;

    async function reveal(userId: string) {
      if (resolved || !active) return;
      resolved = true;

      const { data, error: queryError } = await supabase
        .from("account_login_ids")
        .select("login_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!active) return;

      if (queryError || !data?.login_id) {
        setError("로그인 아이디 정보를 찾지 못했습니다. 다시 시도해주세요.");
        setLoading(false);
        return;
      }

      try {
        localStorage.removeItem("fchelp-find-id-requested");
      } catch {}

      setLoginId(String(data.login_id));
      setLoading(false);
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) void reveal(session.user.id);
    });

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active || resolved) return;
      if (sessionError) {
        setError("이메일 인증 정보를 확인하지 못했습니다.");
        setLoading(false);
        return;
      }
      if (data.session?.user?.id) {
        void reveal(data.session.user.id);
      }
    });

    const timer = window.setTimeout(() => {
      if (!active || resolved) return;
      setError("인증 링크가 만료되었거나 올바르지 않습니다. 아이디 찾기를 다시 요청해주세요.");
      setLoading(false);
    }, 5000);

    return () => {
      active = false;
      window.clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function backToLogin() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f1115] px-4 py-10 text-white sm:px-6">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#181b21] p-6 text-center sm:p-8">
        <Link href="/" className="text-2xl font-extrabold">
          FC <span className="text-lime-400">Help</span>
        </Link>

        {loading ? (
          <div className="py-16">
            <p className="text-sm font-bold text-gray-400">이메일 인증 정보를 확인하는 중...</p>
          </div>
        ) : error ? (
          <div className="py-10">
            <p className="text-3xl">!</p>
            <h1 className="mt-3 text-2xl font-black">아이디를 확인하지 못했습니다.</h1>
            <p className="mt-3 text-sm leading-6 text-gray-400">{error}</p>
            <Link
              href="/recover"
              className="mt-6 inline-block rounded-xl bg-lime-400 px-5 py-3 text-sm font-black text-black"
            >
              아이디 찾기 다시 하기
            </Link>
          </div>
        ) : (
          <div className="py-8">
            <p className="text-[10px] font-black tracking-[0.18em] text-lime-400">LOGIN ID</p>
            <h1 className="mt-2 text-2xl font-black">로그인 아이디를 찾았습니다.</h1>
            <div className="mt-6 rounded-2xl border border-lime-300/20 bg-lime-300/[0.05] px-5 py-5">
              <p className="text-xs font-bold text-gray-500">로그인 아이디</p>
              <p className="mt-2 break-all text-2xl font-black text-lime-200">{loginId}</p>
            </div>
            <p className="mt-4 text-xs leading-5 text-gray-600">
              이메일 본인 확인 과정에서 임시 로그인되었습니다. 비밀번호로 다시 로그인하려면 아래 버튼을 눌러주세요.
            </p>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Link
                href="/mypage"
                className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-gray-200 transition hover:bg-white/5"
              >
                마이페이지로 이동
              </Link>
              <button
                type="button"
                onClick={() => void backToLogin()}
                className="rounded-xl bg-lime-400 px-4 py-3 text-sm font-black text-black transition hover:bg-lime-300"
              >
                아이디로 로그인
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
