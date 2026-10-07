import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit } from "@/lib/security/rateLimit";

const LOGIN_ID_PATTERN = /^[a-z0-9_]{3,20}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function authClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) throw new Error("Supabase auth 환경변수가 설정되지 않았습니다.");

  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function genericResponse() {
  return NextResponse.json(
    {
      ok: true,
      message: "가입된 계정이고 이메일 인증이 필요하다면 인증 메일을 다시 보내드렸습니다.",
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { identifier?: string };
    const identifier = String(body.identifier ?? "").trim().toLowerCase();

    if (!identifier || identifier.length > 254) {
      return NextResponse.json({ error: "아이디 또는 이메일을 입력해주세요." }, { status: 400 });
    }

    const rateLimited = await enforceRateLimit(request, {
      scope: "auth:resend-confirmation",
      rules: [
        { name: "ip", limit: 10, windowSeconds: 3600 },
        { name: "identifier", value: identifier, limit: 3, windowSeconds: 1800 },
      ],
    });
    if (rateLimited) return rateLimited;

    let email = identifier;

    if (!identifier.includes("@")) {
      if (!LOGIN_ID_PATTERN.test(identifier)) return genericResponse();

      const admin = createAdminClient();
      const { data: loginRow } = await admin
        .from("account_login_ids")
        .select("user_id")
        .eq("login_id", identifier)
        .maybeSingle();

      if (!loginRow?.user_id) return genericResponse();

      const { data: userData, error: userError } = await admin.auth.admin.getUserById(loginRow.user_id);
      email = userData.user?.email ?? "";

      if (userError || !email) return genericResponse();
    } else if (!EMAIL_PATTERN.test(identifier)) {
      return NextResponse.json({ error: "이메일 주소를 확인해주세요." }, { status: 400 });
    }

    const origin = new URL(request.url).origin;
    const client = authClient();
    const { error } = await client.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${origin}/login`,
      },
    });

    if (error) {
      console.warn("resend signup confirmation failed", error.code || error.message);
    }

    return genericResponse();
  } catch (error) {
    console.error("resend confirmation route failed", error);
    return genericResponse();
  }
}
