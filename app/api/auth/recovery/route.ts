import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type RecoveryAction = "find-id" | "reset-password";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://fchelp.xyz").replace(/\/$/, "");

function response(message: string, status = 200) {
  return NextResponse.json(
    { ok: status < 400, message },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    }
  );
}

export async function POST(request: Request) {
  let body: { action?: RecoveryAction; email?: string };

  try {
    body = (await request.json()) as { action?: RecoveryAction; email?: string };
  } catch {
    return response("요청 형식이 올바르지 않습니다.", 400);
  }

  const action = body.action;
  const email = String(body.email || "").trim().toLowerCase();

  if ((action !== "find-id" && action !== "reset-password") || !EMAIL_PATTERN.test(email) || email.length > 254) {
    return response("이메일 주소를 확인해주세요.", 400);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !publishableKey) {
    console.error("Account recovery: Supabase public auth environment variables are missing.");
    return response("계정 복구 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해주세요.", 500);
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  try {
    if (action === "find-id") {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${SITE_URL}/recover/id`,
        },
      });

      if (error) {
        console.warn("Account recovery find-id mail was not sent:", error.code || error.message);
      }

      return response("가입된 이메일이라면 아이디 확인 링크를 보내드렸습니다. 받은 편지함을 확인해주세요.");
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${SITE_URL}/recover/password`,
    });

    if (error) {
      console.warn("Account recovery password mail was not sent:", error.code || error.message);
    }

    return response("가입된 이메일이라면 비밀번호 재설정 링크를 보내드렸습니다. 받은 편지함을 확인해주세요.");
  } catch (error) {
    console.error("Account recovery request failed:", error);
    return response(
      action === "find-id"
        ? "가입된 이메일이라면 아이디 확인 링크를 보내드렸습니다. 받은 편지함을 확인해주세요."
        : "가입된 이메일이라면 비밀번호 재설정 링크를 보내드렸습니다. 받은 편지함을 확인해주세요."
    );
  }
}
