import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "이용약관 | FC Help",
  description: "FC Help 서비스 이용약관입니다.",
};

const CONTACT_EMAIL = "devssworkofficial@gmail.com";

const sections = [
  {
    title: "제1조 목적",
    body: [
      "본 약관은 FC Help가 제공하는 선수 정보, 갱신시간 정보, 스쿼드 메이커, 알림 및 기타 관련 서비스의 이용 조건과 이용자와 서비스 간의 기본적인 권리·의무를 정하는 것을 목적으로 합니다.",
    ],
  },
  {
    title: "제2조 서비스의 성격",
    body: [
      "FC Help는 FC 온라인 이용자를 위한 비공식 팬 서비스이며 NEXON, EA 및 관련 권리자와 공식적인 제휴 관계가 없습니다.",
      "서비스에서 제공하는 선수 정보, 시세, 갱신시간, 스쿼드 관련 정보 등은 게임 이용을 돕기 위한 참고 자료이며 실제 게임 내 정보와 차이가 발생할 수 있습니다.",
    ],
  },
  {
    title: "제3조 회원가입 및 계정",
    body: [
      "일부 기능은 이메일 기반 회원가입 및 로그인이 필요할 수 있습니다. 이용자는 정확한 정보를 사용하고 자신의 계정 정보를 안전하게 관리해야 합니다.",
      "타인의 계정을 무단으로 사용하거나 서비스 운영을 방해하기 위한 목적으로 계정을 이용해서는 안 됩니다.",
    ],
  },
  {
    title: "제4조 서비스 이용",
    body: [
      "이용자는 관련 법령과 본 약관을 준수하여 서비스를 이용해야 합니다.",
      "자동화된 비정상 접근, 과도한 요청, 서비스 데이터의 무단 수집, 보안 기능 우회, 서버나 네트워크에 부담을 주는 행위 등 정상적인 서비스 운영을 방해하는 행위를 해서는 안 됩니다.",
    ],
  },
  {
    title: "제5조 이용자 제공 정보",
    body: [
      "갱신시간 제보 등 이용자가 서비스에 정보를 제출하는 기능이 제공될 수 있습니다. 이용자는 자신이 제출하는 정보가 사실에 부합하도록 노력해야 합니다.",
      "운영자는 잘못된 정보, 중복 정보, 광고성 내용, 서비스 운영 목적과 무관한 내용 등을 수정하거나 반영하지 않을 수 있습니다.",
    ],
  },
  {
    title: "제6조 서비스 변경 및 중단",
    body: [
      "서비스의 기능, 화면 구성, 제공 정보 및 운영 방식은 개선이나 유지보수를 위해 변경될 수 있습니다.",
      "서버 장애, 외부 서비스 장애, 점검, 천재지변 또는 운영상 필요한 사유가 있는 경우 서비스의 일부 또는 전부가 일시적으로 중단될 수 있습니다.",
    ],
  },
  {
    title: "제7조 정보의 정확성 및 책임",
    body: [
      "FC Help는 가능한 정확한 정보를 제공하기 위해 노력하지만 모든 정보의 완전성, 정확성, 최신성을 보장하지 않습니다.",
      "이용자는 서비스의 정보를 참고 자료로 활용해야 하며, 게임 내 거래나 기타 판단에 따른 결과는 이용자 본인의 판단에 따라 이루어집니다.",
    ],
  },
  {
    title: "제8조 지식재산권",
    body: [
      "FC 온라인과 관련된 게임 명칭, 선수 이미지, 로고, 상표 및 기타 자료의 권리는 각 권리자에게 있습니다.",
      "FC Help가 자체 제작한 서비스 화면 구성, 코드, 문구 및 독자적인 콘텐츠의 권리는 별도의 표시가 없는 한 FC Help에 있습니다.",
    ],
  },
  {
    title: "제9조 광고 및 외부 서비스",
    body: [
      "서비스에는 향후 Google AdSense 등 제3자의 광고 또는 외부 서비스가 포함될 수 있습니다.",
      "외부 사이트나 광고를 통해 제공되는 상품·서비스는 해당 제공자의 책임 아래 운영되며 FC Help가 해당 거래의 당사자가 되는 것은 아닙니다.",
    ],
  },
  {
    title: "제10조 이용 제한",
    body: [
      "운영자는 서비스 장애 유발, 부정 이용, 타인 권리 침해, 악성 요청 등 서비스의 정상적인 운영을 현저히 방해하는 행위가 확인되는 경우 필요한 범위에서 이용을 제한할 수 있습니다.",
    ],
  },
  {
    title: "제11조 개인정보",
    body: [
      "개인정보의 수집 및 이용에 관한 자세한 내용은 개인정보처리방침에서 확인할 수 있습니다.",
    ],
  },
  {
    title: "제12조 약관의 변경",
    body: [
      "서비스 운영 방식이나 관련 법령의 변경 등에 따라 본 약관이 수정될 수 있습니다. 중요한 변경이 있는 경우 서비스 내 적절한 방법으로 안내합니다.",
    ],
  },
  {
    title: "제13조 문의",
    body: [
      `서비스 및 본 약관에 관한 문의는 ${CONTACT_EMAIL}으로 접수할 수 있습니다.`,
    ],
  },
] as const;

export default function TermsPage() {
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
          Terms of Service
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">이용약관</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-400 sm:text-base">
          FC Help를 이용하기 전에 아래 내용을 확인해주세요. 본 약관은 서비스 이용에 필요한
          기본적인 사항을 안내합니다.
        </p>

        <div className="mt-10 space-y-4">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-white/[0.08] bg-[#15181d] p-5 sm:p-6"
            >
              <h2 className="text-base font-black text-gray-100">{section.title}</h2>
              <div className="mt-3 space-y-2 text-sm leading-7 text-gray-400">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap gap-3 text-sm font-bold">
          <Link
            href="/privacy"
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-gray-300 transition hover:border-lime-300/30 hover:text-lime-300"
          >
            개인정보처리방침
          </Link>
          <Link
            href="/contact"
            className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-gray-300 transition hover:border-lime-300/30 hover:text-lime-300"
          >
            문의하기
          </Link>
        </div>

        <p className="mt-8 text-xs leading-6 text-gray-600">시행일: 2026년 9월 17일</p>
      </div>
    </main>
  );
}
