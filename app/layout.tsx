import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import PushSoundListener from "@/components/PushSoundListener";
import MobileNav from "@/components/MobileNav";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
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
    : "https://fc-help-chi.vercel.app");

const adsenseClient = "ca-pub-6735658400194219";
const defaultTitle = "FC Help - FC 온라인 선수 DB·갱신시간·스쿼드 메이커";
const defaultDescription =
  "FC 온라인 선수 정보, 유저 제보 기반 갱신시간, 브라우저 알림과 스쿼드 메이커를 제공하는 비공식 팬 서비스입니다.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "FC Help",
  title: defaultTitle,
  description: defaultDescription,
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
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    type: "website",
    siteName: "FC Help",
    url: siteUrl,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "FC Help - INFO · SQUAD · ALARM · COMMUNITY",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: ["/opengraph-image"],
  },
  other: {
    "google-adsense-account": adsenseClient,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col pb-20 md:pb-0">
        <Script
          id="google-adsense"
          async
          strategy="beforeInteractive"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
          crossOrigin="anonymous"
        />
        <PushSoundListener />
        <SiteHeader />
        {children}
        <SiteFooter />
        <MobileNav />
      </body>
    </html>
  );
}
