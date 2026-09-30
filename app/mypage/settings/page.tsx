"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MyPageNav from "@/components/MyPageNav";
import { createClient } from "@/lib/supabase/client";

type FcOnlineProfile = {
  ouid: string;
  nickname: string;
  level: number | null;
  divisionId: number | null;
  divisionName: string | null;
  tierSource: "latest_match" | "historical_best" | null;
  lastMatchDate: string | null;
  matchType: number;
};

export default function AccountSettingsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [loginId, setLoginId] = useState("");
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fcNickname, setFcNickname] = useState("");
  const [linkedFcNickname, setLinkedFcNickname] = useState("");
  const [linkedOuid, setLinkedOuid] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [busy, setBusy] = useState<"email" | "password" | "fc" | "delete" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      const { data, error: authError } = await supabase.auth.getUser();
      const user = data.user;
      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const [{ data: loginRow }, { data: profileRow }] = await Promise.all([
        supabase.from("account_login_ids").select("login_id").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("fconline_nickname,fconline_ouid").eq("id", user.id).maybeSingle(),
      ]);

      if (!active) return;
      setUserId(user.id);
      setEmail(user.email ?? "");
      setNewEmail(user.email ?? "");
      setLoginId(loginRow?.login_id ?? "");
      setFcNickname(profileRow?.fconline_nickname ?? "");
      setLinkedFcNickname(profileRow?.fconline_nickname ?? "");
      setLinkedOuid(profileRow?.fconline_ouid ?? "");
      setLoading(false);
    }

    void load();
    return () => {
      active = false;
    };
  }, [router, supabase]);

  function resetNotice() {
    setMessage("");
    setError("");
  }

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function changeEmail() {
    const normalized = newEmail.trim().toLowerCase();
    resetNotice();
    if (!normalized || !normalized.includes("@")) {
      setError("변경할 이메일 주소를 확인해주세요.");
      return;
    }
    if (normalized === email.toLowerCase()) {
      setError("현재 이메일과 같습니다.");
      return;
    }

    setBusy("email");
    const { error: updateError } = await supabase.auth.updateUser({ email: normalized });
    setBusy(null);

    if (updateError) {
      setError(updateError.message.toLowerCase().includes("already") ? "이미 사용 중인 이메일입니다." : updateError.message);
      return;
    }

    setMessage("새 이메일 주소로 확인 메일을 보냈습니다. 메일에서 변경을 승인하면 적용됩니다.");
  }

  async function changePassword() {
    resetNotice();
    if (!currentPassword) {
      setError("현재 비밀번호를 입력해주세요.");
      return;
    }
    if (newPassword.length < 8) {
      setError("새 비밀번호는 8자 이상 입력해주세요.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    if (currentPassword === newPassword) {
      setError("현재 비밀번호와 다른 비밀번호를 입력해주세요.");
      return;
    }

    setBusy("password");
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");

      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "비밀번호 변경에 실패했습니다.");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("비밀번호를 변경했습니다.");
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : "비밀번호 변경에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  }

  async function relinkFcOnline() {
    const nickname = fcNickname.trim();
    resetNotice();
    if (!nickname || nickname.length > 30) {
      setError("FC Online 닉네임을 확인해주세요.");
      return;
    }
    if (!userId) return;

    setBusy("fc");
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");

      const response = await fetch(`/api/fconline/profile?nickname=${encodeURIComponent(nickname)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const payload = (await response.json()) as FcOnlineProfile & { error?: string };
      if (!response.ok || !payload.ouid) {
        throw new Error(payload.error || "해당 FC Online 구단주를 찾을 수 없습니다.");
      }

      const canonicalNickname = (payload.nickname || nickname).trim();
      const now = new Date().toISOString();
      const [{ error: profileError }, { error: authMetaError }, { error: squadError }] = await Promise.all([
        supabase
          .from("profiles")
          .update({
            display_name: canonicalNickname.slice(0, 20),
            fconline_nickname: canonicalNickname,
            fconline_ouid: payload.ouid,
            updated_at: now,
          })
          .eq("id", userId),
        supabase.auth.updateUser({
          data: {
            display_name: canonicalNickname.slice(0, 20),
            fconline_nickname: canonicalNickname,
          },
        }),
        supabase
          .from("squad_posts")
          .update({ author_name: canonicalNickname.slice(0, 40) })
          .eq("author_id", userId),
      ]);

      if (profileError) throw new Error(profileError.message);
      if (authMetaError) throw new Error(authMetaError.message);
      if (squadError) throw new Error(squadError.message);

      setFcNickname(canonicalNickname);
      setLinkedFcNickname(canonicalNickname);
      setLinkedOuid(payload.ouid);
      setMessage(`FC Online '${canonicalNickname}' 구단주로 다시 연동했습니다.`);
    } catch (relinkError) {
      setError(relinkError instanceof Error ? relinkError.message : "FC Online 연동에 실패했습니다.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount() {
    resetNotice();
    if (!deletePassword) {
      setError("회원탈퇴를 위해 현재 비밀번호를 입력해주세요.");
      return;
    }
    if (deleteConfirmation.trim() !== "회원탈퇴") {
      setError("확인란에 '회원탈퇴'를 정확히 입력해주세요.");
      return;
    }

    setBusy("delete");
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");

      const response = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          currentPassword: deletePassword,
          confirmation: deleteConfirmation.trim(),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "회원탈퇴에 실패했습니다.");

      await supabase.auth.signOut().catch(() => undefined);
      router.replace("/");
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "회원탈퇴에 실패했습니다.");
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0f1115] px-4 py-20 text-center text-sm text-gray-500">
        계정 설정을 불러오는 중...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0f1115] text-white">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black tracking-[0.18em] text-lime-400">ACCOUNT</p>
            <h1 className="mt-1 text-3xl font-black">계정 설정</h1>
            <p className="mt-2 text-sm text-gray-500">로그인 정보와 FC Online 연동을 관리합니다.</p>
          </div>
        </div>

        <div className="mt-6">
          <MyPageNav />
        </div>

        {(message || error) && (
          <button
            type="button"
            onClick={resetNotice}
            className={`mt-6 w-full rounded-xl border px-4 py-3 text-left text-sm ${
              error
                ? "border-red-300/20 bg-red-400/5 text-red-200"
                : "border-lime-300/20 bg-lime-300/5 text-lime-100"
            }`}
          >
            {error || message}
          </button>
        )}

        <div className="mt-6 space-y-4">
          <section className="rounded-2xl border border-white/10 bg-[#171b1f] p-5 sm:p-6">
            <h2 className="text-lg font-black">로그인 아이디</h2>
            <p className="mt-1 text-xs text-gray-500">회원가입할 때 만든 FC Help 로그인 전용 아이디입니다.</p>
            <div className="mt-4 rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-sm font-bold text-gray-300">
              {loginId || "로그인 아이디 정보를 찾을 수 없습니다."}
            </div>
            <p className="mt-2 text-[11px] text-gray-600">현재는 로그인 아이디 변경을 지원하지 않습니다. 이메일로도 로그인할 수 있습니다.</p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#171b1f] p-5 sm:p-6">
            <h2 className="text-lg font-black">이메일 변경</h2>
            <p className="mt-1 text-xs text-gray-500">현재 이메일: {email || "-"}</p>
            <input
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder="새 이메일"
              autoComplete="email"
              className="mt-4 w-full rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-sm outline-none focus:border-lime-300/40"
            />
            <button
              type="button"
              onClick={() => void changeEmail()}
              disabled={busy !== null}
              className="mt-3 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-black disabled:opacity-40"
            >
              {busy === "email" ? "변경 요청 중..." : "이메일 변경"}
            </button>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#171b1f] p-5 sm:p-6">
            <h2 className="text-lg font-black">비밀번호 변경</h2>
            <p className="mt-1 text-xs text-gray-500">현재 비밀번호를 다시 확인한 뒤 새 비밀번호로 변경합니다.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                placeholder="현재 비밀번호"
                autoComplete="current-password"
                className="rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-sm outline-none focus:border-lime-300/40 sm:col-span-2"
              />
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="새 비밀번호 · 8자 이상"
                autoComplete="new-password"
                className="rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-sm outline-none focus:border-lime-300/40"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="새 비밀번호 확인"
                autoComplete="new-password"
                className="rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-sm outline-none focus:border-lime-300/40"
              />
            </div>
            <button
              type="button"
              onClick={() => void changePassword()}
              disabled={busy !== null}
              className="mt-3 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-black disabled:opacity-40"
            >
              {busy === "password" ? "변경 중..." : "비밀번호 변경"}
            </button>
          </section>

          <section className="rounded-2xl border border-lime-300/15 bg-[#171b1f] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">FC Online 닉네임</h2>
                <p className="mt-1 text-xs text-gray-500">사이트에서 보이는 닉네임과 FC Online 연동 계정을 함께 변경합니다.</p>
              </div>
              {linkedFcNickname && (
                <span className="rounded-full bg-lime-300/10 px-3 py-1 text-[10px] font-black text-lime-300">연동됨</span>
              )}
            </div>

            {linkedFcNickname && (
              <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-black text-white">{linkedFcNickname}</p>
                <p className="mt-1 break-all text-[10px] text-gray-600">OUID · {linkedOuid || "확인 중"}</p>
              </div>
            )}

            <input
              type="text"
              value={fcNickname}
              onChange={(event) => setFcNickname(event.target.value)}
              placeholder="FC Online 구단주 닉네임"
              maxLength={30}
              className="mt-4 w-full rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-sm outline-none focus:border-lime-300/40"
            />
            <p className="mt-2 text-[11px] text-gray-600">넥슨 Open API에서 실제 존재하는 구단주인지 확인한 뒤 OUID까지 자동 갱신합니다.</p>
            <button
              type="button"
              onClick={() => void relinkFcOnline()}
              disabled={busy !== null}
              className="mt-3 rounded-xl bg-lime-300 px-4 py-2.5 text-xs font-black text-black disabled:opacity-40"
            >
              {busy === "fc" ? "구단주 확인 중..." : "FC Online 다시 연동"}
            </button>
          </section>

          <section className="rounded-2xl border border-red-400/20 bg-red-400/[0.035] p-5 sm:p-6">
            <h2 className="text-lg font-black text-red-200">회원탈퇴</h2>
            <p className="mt-2 text-xs leading-5 text-red-200/60">
              계정, 프로필, 작성한 커뮤니티 글·댓글, 스쿼드 게시물, 좋아요와 알림 정보가 삭제됩니다. 갱신시간 제보 기록은 통계 유지를 위해 계정 연결만 제거한 뒤 익명 기록으로 남습니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="mt-4 grid gap-3">
              <input
                type="password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                placeholder="현재 비밀번호"
                autoComplete="current-password"
                className="rounded-xl border border-red-300/15 bg-[#0f1115] px-4 py-3 text-sm outline-none focus:border-red-300/40"
              />
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                placeholder="확인을 위해 회원탈퇴 입력"
                autoComplete="off"
                className="rounded-xl border border-red-300/15 bg-[#0f1115] px-4 py-3 text-sm outline-none focus:border-red-300/40"
              />
            </div>
            <button
              type="button"
              onClick={() => void deleteAccount()}
              disabled={busy !== null || deleteConfirmation.trim() !== "회원탈퇴" || !deletePassword}
              className="mt-3 rounded-xl bg-red-500 px-4 py-2.5 text-xs font-black text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {busy === "delete" ? "계정 삭제 중..." : "영구적으로 회원탈퇴"}
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}
