import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const suppliedSecret = request.headers.get("x-fc-help-cron-secret");

    if (!suppliedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    const { data: secretRow, error: secretError } = await supabase
      .from("cron_secrets")
      .select("secret")
      .eq("name", "push_run")
      .maybeSingle();

    if (secretError || !secretRow?.secret || secretRow.secret !== suppliedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json(
        { error: "CRON_SECRET is not configured" },
        { status: 500 }
      );
    }

    const runUrl = new URL("/api/push/run", request.url);

    const response = await fetch(runUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
      cache: "no-store",
    });

    const text = await response.text();

    return new NextResponse(text, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    console.log("Supabase Cron relay error:", error);

    return NextResponse.json(
      { error: "Cron relay failed" },
      { status: 500 }
    );
  }
}
