import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

const LOGIN_ID_PATTERN = /^[a-z0-9_]{3,20}$/;

function authClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase auth 환경변수가 설정되지 않았습니다.");
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { identifier?: string; password?: string };
    const identifier = String(body.identifier ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!identifier || !password) {
      return NextResponse.json({ error: "로그인 아이디와 비밀번호를 입력해주세요." }, { status: 400 });
    }

    let email = identifier;

    if (!identifier.includes("@")) {
      if (!LOGIN_ID_PATTERN.test(identifier)) {
        return NextResponse.json({ error: "로그인 아이디 또는 비밀번호가 맞지 않습니다." }, { status: 401 });
      }

      const admin = createAdminClient();
      const { data: loginRow } = await admin
        .from("account_login_ids")
        .select("user_id")
        .eq("login_id", identifier)
        .maybeSingle();

      if (!loginRow?.user_id) {
        return NextResponse.json({ error: "로그인 아이디 또는 비밀번호가 맞지 않습니다." }, { status: 401 });
      }

      const { data: userData, error: userError } = await admin.auth.admin.getUserById(loginRow.user_id);
      email = userData.user?.email ?? "";
      if (userError || !email) {
        return NextResponse.json({ error: "로그인 아이디 또는 비밀번호가 맞지 않습니다." }, { status: 401 });
      }
    }

    const client = authClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });

    if (error || !data.session) {
      const emailNotConfirmed = error?.message?.toLowerCase().includes("email not confirmed") ?? false;
      const message = emailNotConfirmed
        ? "이메일 인증이 아직 완료되지 않았습니다. 받은 편지함의 인증 메일을 확인해주세요."
        : "로그인 아이디 또는 비밀번호가 맞지 않습니다.";
      return NextResponse.json(
        {
          error: message,
          code: emailNotConfirmed ? "email_not_confirmed" : "invalid_credentials",
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (error) {
    console.error("login route failed", error);
    return NextResponse.json({ error: "로그인 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
