import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FC 온라인 정보 활용 가이드 | FC Help",
  description: "FC Help의 선수 DB, 갱신시간 제보 및 스쿼드 기능을 활용하는 방법과 데이터 해석 시 유의사항을 설명합니다.",
  alternates: { canonical: "/guide" },
};

const guides = [
  {
    id: "player",
    label: "01 / PLAYER DATA",
    title: "선수 DB는 이렇게 활용하세요",
    paragraphs: [
      "선수 검색에서 이름을 입력하면 FC 온라인 선수와 시즌별 결과를 찾아볼 수 있습니다. 같은 선수라도 시즌에 따라 표시되는 정보가 다르므로, 이름뿐 아니라 시즌도 함께 확인하는 것이 좋습니다.",
      "OVR은 선수를 비교할 때 참고할 수 있는 지표지만, 하나의 숫자만으로 실제 사용감을 설명하지는 못합니다. 선호 포지션, 팀 구성, 강화 단계와 함께 비교해 보세요.",
      "게임 데이터는 업데이트에 따라 달라질 수 있습니다. 중요한 결정을 하기 전에는 실제 게임 내 수치와 표기도 다시 확인해 주세요.",
    ],
    href: "/players",
    link: "선수 DB에서 검색하기",
  },
  {
    id: "refresh",
    label: "02 / REFRESH REPORTS",
    title: "갱신시간은 확정 시각이 아닌 참고 정보입니다",
    paragraphs: [
      "FC Help의 갱신시간 정보는 공개 참고값과 이용자 제보를 바탕으로 제공됩니다. 제보가 여러 건 모여도 매번 정확히 같은 분에 갱신된다는 뜻은 아닙니다.",
      "표시된 홀수시·짝수시·매시간 등의 구분과 분 단위 정보를 함께 확인하세요. 제보 시각, 데이터의 양, 서로 다른 제보 간 차이를 살펴보면 정보를 더 신중하게 활용할 수 있습니다.",
      "브라우저 알림은 확인을 돕는 기능이며 실제 게임 내 갱신 또는 거래 성공을 보장하지 않습니다. 알림 권한이나 기기 설정에 따라 전달이 지연될 수도 있습니다.",
    ],
    href: "/refresh",
    link: "갱신시간 확인하기",
  },
  {
    id: "squad",
    label: "03 / SQUAD BUILDING",
    title: "스쿼드는 목적부터 정하면 편리합니다",
    paragraphs: [
      "스쿼드 메이커에서는 선수를 배치하고 포메이션, 강화 단계 등 다양한 조건을 조합해 볼 수 있습니다. 먼저 사용하려는 포메이션과 핵심 포지션을 정한 다음 나머지 자리를 채워 보세요.",
      "선수 가치나 팀 구성은 실제 게임 내 조건과 차이가 있을 수 있습니다. 화면의 결과를 최종 확정값으로 받아들이기보다 여러 조합을 비교하는 참고 자료로 사용해 주세요.",
      "완성한 스쿼드를 공유하면 다른 이용자의 의견을 받을 수 있습니다. 다른 사람의 스쿼드를 참고할 때는 포메이션과 선수 배치의 이유도 함께 살펴보는 것이 좋습니다.",
    ],
    href: "/squad",
    link: "스쿼드 기능 살펴보기",
  },
];

export default function GuidePage() {
  return (
    <main className="min-h-screen bg-[#0f1115] text-white">
      <div className="mx-auto max-w-5xl px-5 py-12 sm:px-6 sm:py-16">
        <Link href="/" className="text-sm font-bold text-gray-400 transition hover:text-lime-300">
          ← FC Help 홈
        </Link>
        <p className="mt-10 text-xs font-black tracking-[0.2em] text-lime-300">FC HELP GUIDE</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">FC 온라인 정보 활용 가이드</h1>
        <p className="mt-5 max-w-3xl text-sm leading-8 text-gray-300 sm:text-base">
          FC Help는 선수 데이터 조회, 갱신시간 제보 확인, 스쿼드 구성에 필요한 도구를 제공하는 비공식 팬 서비스입니다.
          아래 안내는 각 기능을 이용할 때 무엇을 확인하고 어떤 점에 유의해야 하는지 설명합니다.
        </p>

        <nav aria-label="가이드 목차" className="mt-9 flex flex-wrap gap-3">
          {guides.map((guide) => (
            <a key={guide.id} href={`#${guide.id}`} className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-gray-200 hover:border-lime-300/50 hover:text-lime-300">
              {guide.title}
            </a>
          ))}
        </nav>

        <div className="mt-10 space-y-6">
          {guides.map((guide) => (
            <section key={guide.id} id={guide.id} className="scroll-mt-24 rounded-2xl border border-white/10 bg-[#15191d] px-5 py-7 sm:px-8 sm:py-9">
              <p className="text-xs font-black tracking-[0.18em] text-lime-300">{guide.label}</p>
              <h2 className="mt-3 text-2xl font-black">{guide.title}</h2>
              <div className="mt-5 space-y-4 text-sm leading-8 text-gray-300 sm:text-base">
                {guide.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
              <Link href={guide.href} className="mt-6 inline-flex font-bold text-lime-300 hover:text-lime-200">
                {guide.link} →
              </Link>
            </section>
          ))}
        </div>
        <p className="mt-10 text-xs leading-7 text-gray-500">
          FC Help는 NEXON 및 EA와 공식 제휴 관계가 없습니다. 실제 게임 정보는 게임 내 표시를 우선하여 확인해 주세요.
          오류 또는 수정 요청은 <Link href="/contact" className="underline hover:text-white">문의 페이지</Link>에서 접수할 수 있습니다.
        </p>
      </div>
    </main>
  );
}
