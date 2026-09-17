import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import PushSoundListener from "@/components/PushSoundListener";
import MobileNav from "@/components/MobileNav";
import SiteFooter from "@/components/SiteFooter";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined);

const adsenseClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.startsWith("ca-pub-")
  ? process.env.NEXT_PUBLIC_ADSENSE_CLIENT
  : undefined;

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
  applicationName: "FC Help",
  title: "FC Help - FC 온라인 선수 DB·갱신시간·스쿼드 메이커",
  description:
    "FC 온라인 선수 정보, 유저 제보 기반 갱신시간, 브라우저 알림과 스쿼드 메이커를 제공하는 비공식 팬 서비스입니다.",
  keywords: [
    "FC 온라인",
    "FC온라인",
    "FC Help",
    "선수 DB",
    "갱신시간",
    "스쿼드 메이커",
  ],
  robots: {
    index: true,
    follow: true,
  },
  ...(adsenseClient
    ? {
        other: {
          "google-adsense-account": adsenseClient,
        },
      }
    : {}),
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col pb-20 md:pb-0">
        {adsenseClient && (
          <Script
            id="google-adsense"
            async
            strategy="beforeInteractive"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
            crossOrigin="anonymous"
          />
        )}
        <PushSoundListener />
        {children}
        <SiteFooter />
        <MobileNav />
      </body>
    </html>
  );
}
