import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RateLimitRule = {
  name: string;
  limit: number;
  windowSeconds: number;
  value?: string | null;
};

type RateLimitOptions = {
  scope: string;
  rules: RateLimitRule[];
};

type RateLimitRow = {
  allowed?: boolean;
  remaining?: number;
  retry_after_seconds?: number;
};

function clientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const firstForwarded = forwarded?.split(",")[0]?.trim();
  if (firstForwarded) return firstForwarded;

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const userAgent = request.headers.get("user-agent")?.slice(0, 160) || "unknown";
  return `unknown:${userAgent}`;
}

function fingerprint(value: string) {
  const secret =
    process.env.RATE_LIMIT_SALT ||
    process.env.SUPABASE_SECRET_KEY ||
    "fc-help-rate-limit-v1";

  return createHmac("sha256", secret)
    .update(value)
    .digest("hex")
    .slice(0, 48);
}

export async function enforceRateLimit(
  request: Request,
  options: RateLimitOptions
): Promise<NextResponse | null> {
  const ip = clientAddress(request);
  const admin = createAdminClient();
  let retryAfter = 0;

  try {
    for (const rule of options.rules) {
      const rawValue =
        rule.value == null
          ? ip
          : String(rule.value).trim().toLowerCase();

      const key = [
        "fc-help",
        options.scope,
        rule.name,
        fingerprint(rawValue),
      ].join(":");

      const { data, error } = await admin.rpc("consume_api_rate_limit", {
        p_key: key,
        p_limit: rule.limit,
        p_window_seconds: rule.windowSeconds,
      });

      if (error) {
        console.error("rate limit RPC failed", {
          scope: options.scope,
          rule: rule.name,
          code: error.code,
        });
        continue;
      }

      const row = (Array.isArray(data) ? data[0] : data) as RateLimitRow | null;
      if (row?.allowed === false) {
        retryAfter = Math.max(
          retryAfter,
          Number(row.retry_after_seconds || 1)
        );
      }
    }
  } catch (error) {
    console.error("rate limit check failed", {
      scope: options.scope,
      error,
    });
    return null;
  }

  if (retryAfter <= 0) return null;

  return NextResponse.json(
    {
      error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
      code: "rate_limited",
      retryAfter,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "Cache-Control": "private, no-store, max-age=0",
      },
    }
  );
}
