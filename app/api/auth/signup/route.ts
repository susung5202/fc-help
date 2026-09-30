import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

const LOGIN_ID_PATTERN = /^[a-z0-9_]{3,20}$/;
const NEXON_BASE_URL = "https://open.api.nexon.com/fconline/v1";

type NexonUserId = {
  ouid?: string;
};

type NexonUserBasic = {
  ouid?: string;
  nickname?: string;
};

function getApiKey() {
  return (
    process.env.NEXON_OPEN_API_KEY ||
    process.env.NEXON_API_KEY ||
    process.env.NEXON_FCONLINE_API_KEY ||
    process.env.FC_ONLINE_API_KEY ||
    ""
  );
}

function authClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase auth 환경변수가 설정되지 않았습니다.");

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function nexonFetch<T>(url: string, apiKey: string): Promise<T> {
  const response = await fetch(url, {
    headers: { "x-nxopen-api-key": apiKey },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`NEXON_${response.status}:${detail.slice(0, 160)}`);
  }

  return response.json() as Promise<T>;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      loginId?: string;
      fcNickname?: string;
      password?: string;
    };

    const email = String(body.email ?? "").trim().toLowerCase();
    const loginId = String(body.loginId ?? "").trim().toLowerCase();
    const fcNickname = String(body.fcNickname ?? "").trim();
    const password = String(body.password ?? "");

    if (!email || !loginId || !fcNickname || !password) {
      return NextResponse.json(
        { error: "이메일, 로그인 아이디, FC Online 닉네임, 비밀번호를 모두 입력해주세요." },
        { status: 400 }
      );
    }

    if (!LOGIN_ID_PATTERN.test(loginId)) {
      return NextResponse.json(
        { error: "로그인 아이디는 영문 소문자, 숫자, 밑줄(_)만 사용해 3~20자로 입력해주세요." },
        { status: 400 }
      );
    }

    if (fcNickname.length > 20) {
      return NextResponse.json({ error: "FC Online 닉네임은 20자 이하로 입력해주세요." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "비밀번호는 6자 이상 입력해주세요." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: existingLoginId, error: loginIdError } = await admin
      .from("account_login_ids")
      .select("user_id")
      .eq("login_id", loginId)
      .maybeSingle();

    if (loginIdError) {
      console.error("signup login id check failed", loginIdError);
      return NextResponse.json({ error: "로그인 아이디 확인에 실패했습니다." }, { status: 500 });
    }

    if (existingLoginId) {
      return NextResponse.json({ error: "이미 사용 중인 로그인 아이디입니다." }, { status: 409 });
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: "FC Online 연동 서버 설정을 확인해주세요." }, { status: 503 });
    }

    let ouid = "";
    let canonicalNickname = fcNickname;

    try {
      const userId = await nexonFetch<NexonUserId>(
        `${NEXON_BASE_URL}/id?nickname=${encodeURIComponent(fcNickname)}`,
        apiKey
      );

      if (!userId.ouid) {
        return NextResponse.json({ error: "존재하지 않는 FC Online 닉네임입니다." }, { status: 404 });
      }

      ouid = userId.ouid;
      const basic = await nexonFetch<NexonUserBasic>(
        `${NEXON_BASE_URL}/user/basic?ouid=${encodeURIComponent(ouid)}`,
        apiKey
      );
      canonicalNickname = String(basic.nickname || fcNickname).trim();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const statusMatch = message.match(/^NEXON_(\d+):/);
      const nexonStatus = statusMatch ? Number(statusMatch[1]) : 0;

      if (nexonStatus === 400 || nexonStatus === 404) {
        return NextResponse.json({ error: "존재하지 않는 FC Online 닉네임입니다." }, { status: 404 });
      }
      if (nexonStatus === 429) {
        return NextResponse.json(
          { error: "FC Online 조회 요청이 많습니다. 잠시 후 다시 시도해주세요." },
          { status: 429 }
        );
      }

      console.error("signup FC Online nickname validation failed", error);
      return NextResponse.json({ error: "FC Online 닉네임 확인에 실패했습니다." }, { status: 502 });
    }

    const origin = new URL(request.url).origin;
    const client = authClient();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/login`,
        data: {
          login_id: loginId,
          display_name: canonicalNickname,
          fconline_nickname: canonicalNickname,
          fconline_ouid: ouid,
        },
      },
    });

    if (error) {
      const normalized = error.message.toLowerCase();
      if (normalized.includes("user already registered")) {
        return NextResponse.json({ error: "이미 가입된 이메일입니다." }, { status: 409 });
      }
      if (normalized.includes("database error saving new user")) {
        return NextResponse.json(
          { error: "회원가입 정보를 저장하지 못했습니다. 로그인 아이디 중복 여부를 확인해주세요." },
          { status: 409 }
        );
      }
      if (normalized.includes("password") && normalized.includes("characters")) {
        return NextResponse.json({ error: "비밀번호는 6자 이상 입력해주세요." }, { status: 400 });
      }

      console.error("verified signup failed", error);
      return NextResponse.json({ error: "회원가입에 실패했습니다." }, { status: 400 });
    }

    return NextResponse.json({
      nickname: canonicalNickname,
      ouid,
      emailConfirmationRequired: !data.session,
      access_token: data.session?.access_token ?? null,
      refresh_token: data.session?.refresh_token ?? null,
    });
  } catch (error) {
    console.error("signup route failed", error);
    return NextResponse.json({ error: "회원가입 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
