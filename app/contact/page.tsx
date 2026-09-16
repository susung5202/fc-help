import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "문의 | FC Help",
  description: "FC Help 기능 오류, 정보 수정, 제휴 및 광고 관련 문의 안내입니다.",
};

const CONTACT_EMAIL = "devssworkofficial@gmail.com";

export default function ContactPage() {
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
          Contact
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">문의</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-400 sm:text-base">
          FC Help 이용 중 발견한 오류, 선수 및 갱신시간 정보 수정 요청, 서비스 제안,
          제휴 및 광고 관련 문의를 받고 있습니다.
        </p>

        <section className="mt-10 rounded-2xl border border-white/10 bg-[#15181d] p-5 sm:p-7">
          <p className="text-sm font-black text-white">이메일 문의</p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-2 inline-block break-all text-lg font-black text-lime-300 transition hover:text-lime-200"
          >
            {CONTACT_EMAIL}
          </a>
          <p className="mt-3 text-xs leading-6 text-gray-500">
            오류 문의 시 문제가 발생한 페이지, 선수명 또는 상황을 함께 적어주시면 확인에 도움이 됩니다.
          </p>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            ["기능 오류", "페이지 오류, 스쿼드 메이커, 알림 등 서비스 이용 중 발생한 문제"],
            ["정보 수정", "선수 정보나 갱신시간 등 잘못되었거나 수정이 필요한 정보"],
            ["서비스 제안", "추가되었으면 하는 기능이나 사용성 개선 의견"],
            ["제휴 · 광고", "서비스 제휴, 광고 및 기타 비즈니스 관련 문의"],
          ].map(([title, description]) => (
            <div key={title} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4">
              <p className="text-sm font-black text-gray-200">{title}</p>
              <p className="mt-2 text-xs leading-5 text-gray-500">{description}</p>
            </div>
          ))}
        </section>

        <p className="mt-10 text-xs leading-6 text-gray-600">
          FC Help는 NEXON 및 EA와 공식적인 제휴 관계가 없는 비공식 팬 서비스입니다.
        </p>
      </div>
    </main>
  );
}
