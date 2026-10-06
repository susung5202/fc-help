import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };
    const id = String(body.id ?? "").trim();

    if (!UUID_PATTERN.test(id)) {
      return NextResponse.json({ error: "잘못된 게시글 ID입니다." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin.rpc("increment_squad_post_views", { target_id: id });

    if (error) {
      console.warn("squad view increment failed", error);
      return NextResponse.json({ error: "조회수 반영에 실패했습니다." }, { status: 500 });
    }

    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("squad view route failed", error);
    return NextResponse.json({ error: "조회수 반영에 실패했습니다." }, { status: 500 });
  }
}
