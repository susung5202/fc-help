import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const LOGIN_ID_PATTERN = /^[a-z0-9_]{3,20}$/;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { loginId?: string };
    const loginId = String(body.loginId ?? "").trim().toLowerCase();

    if (!LOGIN_ID_PATTERN.test(loginId)) {
      return NextResponse.json({ available: false, valid: false });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("account_login_ids")
      .select("user_id")
      .eq("login_id", loginId)
      .maybeSingle();

    if (error) {
      console.error("login id availability check failed", error);
      return NextResponse.json({ error: "아이디 확인에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ available: !data, valid: true });
  } catch (error) {
    console.error("login id availability route failed", error);
    return NextResponse.json({ error: "아이디 확인에 실패했습니다." }, { status: 500 });
  }
}
