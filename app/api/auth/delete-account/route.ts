import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

function passwordAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase auth 환경변수가 설정되지 않았습니다.");

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  if (!accessToken) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      currentPassword?: string;
      confirmation?: string;
    };
    const currentPassword = String(body.currentPassword ?? "");
    const confirmation = String(body.confirmation ?? "").trim();

    if (!currentPassword) {
      return NextResponse.json({ error: "현재 비밀번호를 입력해주세요." }, { status: 400 });
    }
    if (confirmation !== "회원탈퇴") {
      return NextResponse.json({ error: "확인란에 '회원탈퇴'를 정확히 입력해주세요." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
    const user = userData.user;
    if (userError || !user?.email) {
      return NextResponse.json({ error: "로그인 정보를 확인할 수 없습니다." }, { status: 401 });
    }

    const verifier = passwordAuthClient();
    const { error: verifyError } = await verifier.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyError) {
      return NextResponse.json({ error: "현재 비밀번호가 맞지 않습니다." }, { status: 401 });
    }

    const { data: communityRows } = await admin
      .from("community_posts")
      .select("image_paths")
      .eq("author_id", user.id);
    const communityPaths = (communityRows ?? []).flatMap((row) =>
      Array.isArray(row.image_paths) ? row.image_paths.filter((path): path is string => typeof path === "string") : []
    );

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error("account delete failed", deleteError);
      return NextResponse.json({ error: "회원탈퇴에 실패했습니다." }, { status: 500 });
    }

    const cleanupTasks: Promise<unknown>[] = [
      admin.storage.from("avatars").remove([`${user.id}/avatar`]),
    ];
    if (communityPaths.length > 0) {
      cleanupTasks.push(admin.storage.from("community-media").remove(communityPaths));
    }
    await Promise.allSettled(cleanupTasks);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("delete account route failed", error);
    return NextResponse.json({ error: "회원탈퇴 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
