import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

const CRON_SOURCE = "supabase-pg-cron";

export async function GET(request: Request) {
  try {
    if (request.headers.get("x-fc-help-cron-source") !== CRON_SOURCE) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const now = new Date();
    const minuteKey = now.toISOString().slice(0, 16);

    const { error: lockError } = await supabase
      .from("cron_invocations")
      .insert({ minute_key: minuteKey });

    if (lockError) {
      if (lockError.code === "23505") {
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: "This minute was already processed",
        });
      }

      throw lockError;
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
