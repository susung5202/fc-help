import webpush from "web-push";
import { NextResponse } from "next/server";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const subscription = body.subscription;

    if (!subscription) {
      return NextResponse.json(
        {
          error: "Push 구독 정보가 없습니다.",
        },
        {
          status: 400,
        }
      );
    }

    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim().slice(0, 80)
        : "FC Help";

    const message =
      typeof body.message === "string" && body.message.trim()
        ? body.message.trim().slice(0, 160)
        : "브라우저 알림이 정상적으로 연결되었습니다. ⚽";

    const url =
      typeof body.url === "string" && body.url.startsWith("/")
        ? body.url
        : "/";

    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title,
        body: message,
        url,
      })
    );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.log("Push 테스트 실패:", error);

    return NextResponse.json(
      {
        error: "테스트 알림 발송에 실패했습니다.",
      },
      {
        status: 500,
      }
    );
  }
}