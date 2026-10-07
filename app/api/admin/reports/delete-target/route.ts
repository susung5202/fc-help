import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
      reportId?: string;
      resolutionNote?: string;
    };
    const reportId = String(body.reportId ?? "").trim();
    const resolutionNote = String(body.resolutionNote ?? "")
      .trim()
      .slice(0, 500);

    if (!reportId) {
      return NextResponse.json({ error: "신고 정보를 확인해주세요." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
    const user = authData.user;

    if (authError || !user) {
      return NextResponse.json({ error: "로그인 정보를 확인할 수 없습니다." }, { status: 401 });
    }

    const { data: adminRow, error: adminError } = await admin
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError) {
      console.error("admin report delete permission check failed", adminError);
      return NextResponse.json({ error: "관리자 권한 확인에 실패했습니다." }, { status: 500 });
    }
    if (!adminRow) {
      return NextResponse.json({ error: "관리자 권한이 없습니다." }, { status: 403 });
    }

    const { data, error } = await admin.rpc("admin_resolve_report_with_delete", {
      p_report_id: reportId,
      p_resolved_by: user.id,
      p_resolution_note: resolutionNote || "신고 대상 콘텐츠 삭제",
    });

    if (error) {
      if (error.code === "P0002") {
        return NextResponse.json(
          { error: "신고 대상 콘텐츠를 찾을 수 없습니다. 목록을 새로고침해주세요." },
          { status: 404 }
        );
      }
      if (error.code === "42501") {
        return NextResponse.json({ error: "관리자 권한이 없습니다." }, { status: 403 });
      }

      console.error("atomic report target delete failed", error);
      return NextResponse.json({ error: "콘텐츠 삭제 처리에 실패했습니다." }, { status: 500 });
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result) {
      return NextResponse.json({ error: "신고 처리 결과를 확인하지 못했습니다." }, { status: 500 });
    }

    return NextResponse.json({
      reportId: result.report_id,
      targetType: result.target_type,
      targetId: result.target_id,
      status: result.status,
      resolvedAt: result.resolved_at,
      resolutionNote: resolutionNote || "신고 대상 콘텐츠 삭제",
      resolvedBy: user.id,
    });
  } catch (error) {
    console.error("admin report delete route failed", error);
    return NextResponse.json({ error: "콘텐츠 삭제 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
