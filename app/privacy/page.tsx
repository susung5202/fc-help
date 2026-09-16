import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보처리방침 | FC Help",
  description: "FC Help 개인정보처리방침입니다.",
};

const CONTACT_EMAIL = "devssworkofficial@gmail.com";

const sections = [
  {
    title: "1. 수집하는 개인정보",
    body: (
      <>
        <p>
          FC Help는 회원가입 및 로그인 기능 제공을 위해 이메일 주소와 인증에 필요한 계정 정보를 처리할 수 있습니다.
          비밀번호는 FC Help가 직접 보관하는 방식이 아니라 인증 서비스 제공업체를 통해 처리됩니다.
        </p>
        <p>
          브라우저 알림을 활성화한 경우 알림 전송을 위해 사용자 식별자와 Push 구독 정보
          (endpoint, p256dh, auth 등)가 저장될 수 있습니다.
        </p>
        <p>
          서비스 이용 과정에서 접속 일시, IP 주소, 브라우저 및 기기 정보, 쿠키·세션 정보 등이
          서비스 운영 또는 보안 목적으로 자동 생성되거나 인프라 제공업체에서 처리될 수 있습니다.
        </p>
      </>
    ),
  },
  {
    title: "2. 개인정보 이용 목적",
    body: (
      <>
        <p>수집된 정보는 회원 식별 및 로그인, 갱신시간 제보·알림 기능 제공, 서비스 오류 대응, 부정 이용 방지와 보안, 서비스 개선을 위해 사용됩니다.</p>
      </>
    ),
  },
  {
    title: "3. 보관 기간",
    body: (
      <>
        <p>
          회원 정보는 원칙적으로 회원 탈퇴 또는 삭제 요청 시까지 보관하며, 관련 법령에 따라 일정 기간 보관이 필요한 경우에는 해당 기간 동안 보관할 수 있습니다.
        </p>
        <p>
          Push 구독 정보는 알림 기능 제공에 필요한 동안 보관되며, 알림 해제 또는 삭제 요청 시 삭제될 수 있습니다.
          접속 로그 등은 보안과 서비스 운영 목적에 필요한 범위에서 인프라 제공업체의 정책에 따라 일정 기간 보관될 수 있습니다.
        </p>
      </>
    ),
  },
  {
    title: "4. 외부 서비스 이용",
    body: (
      <>
        <p>
          FC Help는 서비스 운영을 위해 Supabase의 인증·데이터베이스 기능과 Vercel의 웹 호스팅·배포 기능을 이용할 수 있습니다.
          이 과정에서 서비스 제공에 필요한 정보가 해당 사업자의 시스템에서 처리될 수 있습니다.
        </p>
      </>
    ),
  },
  {
    title: "5. 쿠키 및 로컬 저장소",
    body: (
      <>
        <p>
          로그인 상태 유지 등 기본 기능을 위해 쿠키 또는 유사한 저장 기술이 사용될 수 있습니다.
          스쿼드 메이커의 스쿼드 정보는 사용자의 브라우저 로컬 저장소에 저장될 수 있으며,
          해당 데이터는 브라우저 저장소를 삭제하면 함께 삭제될 수 있습니다.
        </p>
      </>
    ),
  },
  {
    title: "6. 광고 서비스",
    body: (
      <>
        <p>
          FC Help는 향후 Google AdSense 등 제3자 광고 서비스를 사용할 수 있습니다.
          광고 서비스가 적용되는 경우 Google을 포함한 제3자 사업자는 광고 제공, 빈도 제한,
          성과 측정 등을 위해 쿠키 또는 유사 기술을 사용할 수 있습니다.
          광고 관련 처리 내용이 변경되는 경우 본 방침을 함께 업데이트합니다.
        </p>
      </>
    ),
  },
  {
    title: "7. 이용자의 권리",
    body: (
      <>
        <p>
          이용자는 자신의 개인정보에 대해 열람, 정정, 삭제 또는 처리 중지를 요청할 수 있습니다.
          계정 또는 개인정보 관련 요청은 아래 이메일로 문의해 주세요.
        </p>
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="mt-3 inline-block break-all font-black text-lime-300 transition hover:text-lime-200"
        >
          {CONTACT_EMAIL}
        </a>
      </>
    ),
  },
  {
    title: "8. 개인정보 보호 및 안전",
    body: (
      <>
        <p>
          FC Help는 개인정보의 분실, 오용, 무단 접근을 줄이기 위해 필요한 기술적·관리적 보호 조치를 적용하도록 노력합니다.
          다만 인터넷을 통한 전송과 저장 방식의 특성상 절대적인 보안을 보장할 수는 없습니다.
        </p>
      </>
    ),
  },
  {
    title: "9. 방침의 변경",
    body: (
      <>
        <p>
          서비스 기능, 개인정보 처리 방식 또는 관련 정책이 변경되는 경우 본 개인정보처리방침이 수정될 수 있습니다.
          중요한 변경이 있는 경우 서비스 내에서 알릴 수 있습니다.
        </p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0f1115] text-white">
      <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-6 sm:py-16">
        <Link
          href="/"
          className="text-sm font-bold text-gray-500 transition hover:text-lime-300"
        >
          ← FC Help 홈
        </Link>

        <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-lime-400">
          Privacy Policy
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">개인정보처리방침</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-400 sm:text-base">
          FC Help는 서비스 제공에 필요한 범위에서 개인정보를 처리하며, 이용자의 개인정보 보호를 중요하게 생각합니다.
        </p>

        <div className="mt-10 space-y-4">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-white/10 bg-[#15181d] p-5 sm:p-7"
            >
              <h2 className="text-base font-black text-white sm:text-lg">{section.title}</h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-gray-400">{section.body}</div>
            </section>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-lime-300/15 bg-lime-300/[0.04] p-5 text-xs leading-6 text-gray-400">
          <p className="font-black text-gray-200">시행일: 2026년 9월 16일</p>
          <p className="mt-1">개인정보 관련 문의: {CONTACT_EMAIL}</p>
        </div>
      </div>
    </main>
  );
}
