import Link from "next/link";

export const metadata = {
  title: "스쿼드 | FC Help",
  description: "FC Help 스쿼드 메이커와 유저 스쿼드 갤러리 중 원하는 기능을 선택하세요.",
};

export default function SquadPage() {
  return (
    <main className="bg-[#0f1115] text-white">
      <section className="grid min-h-[calc(100svh-9rem)] grid-rows-2 overflow-hidden md:grid-cols-2 md:grid-rows-1">
        <Link
          href="/squad/maker"
          className="group relative flex min-h-[42svh] items-end overflow-hidden border-b border-white/10 bg-[#111713] p-6 transition md:min-h-[620px] md:border-b-0 md:border-r md:p-10 lg:p-14"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(163,230,53,0.17),transparent_42%)] opacity-80 transition duration-500 group-hover:opacity-100" />
          <div className="absolute inset-x-[10%] top-[12%] bottom-[27%] rounded-[28px] border border-lime-300/20 bg-lime-300/[0.025] transition duration-500 group-hover:border-lime-300/35 group-hover:bg-lime-300/[0.04]">
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-lime-300/15" />
            <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-lime-300/15 sm:h-28 sm:w-28" />
            <div className="absolute left-[18%] top-[18%] h-3 w-3 rounded-full bg-lime-300/70 shadow-[0_0_22px_rgba(163,230,53,0.45)]" />
            <div className="absolute left-[38%] top-[34%] h-3 w-3 rounded-full bg-lime-300/70" />
            <div className="absolute right-[18%] top-[18%] h-3 w-3 rounded-full bg-lime-300/70" />
            <div className="absolute right-[38%] top-[34%] h-3 w-3 rounded-full bg-lime-300/70" />
            <div className="absolute left-[20%] bottom-[18%] h-3 w-3 rounded-full bg-lime-300/70" />
            <div className="absolute left-1/2 bottom-[12%] h-3 w-3 -translate-x-1/2 rounded-full bg-lime-300/70" />
            <div className="absolute right-[20%] bottom-[18%] h-3 w-3 rounded-full bg-lime-300/70" />
          </div>

          <div className="relative z-10 max-w-xl">
            <p className="text-xs font-black tracking-[0.18em] text-lime-300 sm:text-sm">SQUAD MAKER</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">스쿼드 메이커</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-gray-400 sm:text-base">
              선수를 직접 배치하고 포메이션, 강화 단계, 팀컬러와 선수 가치를 확인해 나만의 스쿼드를 만듭니다.
            </p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-lime-300">
              스쿼드 만들기 <span className="transition group-hover:translate-x-1">→</span>
            </span>
          </div>
        </Link>

        <Link
          href="/squad/gallery"
          className="group relative flex min-h-[42svh] items-end overflow-hidden bg-[#131419] p-6 transition md:min-h-[620px] md:p-10 lg:p-14"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(255,255,255,0.09),transparent_42%)] opacity-80 transition duration-500 group-hover:opacity-100" />
          <div className="absolute inset-x-[12%] top-[13%] bottom-[29%] flex flex-col gap-3 sm:gap-4">
            <div className="translate-x-4 rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-2xl transition duration-500 group-hover:translate-x-0">
              <div className="flex items-center justify-between gap-3">
                <div className="h-3 w-28 rounded-full bg-white/15" />
                <div className="h-3 w-10 rounded-full bg-lime-300/40" />
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                <div className="h-10 rounded-lg bg-white/[0.05]" />
                <div className="h-10 rounded-lg bg-white/[0.05]" />
                <div className="h-10 rounded-lg bg-white/[0.05]" />
                <div className="h-10 rounded-lg bg-white/[0.05]" />
              </div>
            </div>
            <div className="-translate-x-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-2xl transition duration-500 group-hover:translate-x-0">
              <div className="h-3 w-36 rounded-full bg-white/15" />
              <div className="mt-4 flex gap-2">
                <div className="h-14 flex-1 rounded-lg bg-white/[0.045]" />
                <div className="h-14 flex-1 rounded-lg bg-white/[0.045]" />
                <div className="h-14 flex-1 rounded-lg bg-white/[0.045]" />
              </div>
            </div>
          </div>

          <div className="relative z-10 max-w-xl">
            <p className="text-xs font-black tracking-[0.18em] text-gray-300 sm:text-sm">SQUAD GALLERY</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">스쿼드 갤러리</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-gray-400 sm:text-base">
              다른 유저가 공유한 스쿼드를 구경하고 검색하며 좋아요와 댓글로 의견을 나눕니다.
            </p>
            <span className="mt-5 inline-flex items-center gap-2 text-sm font-black text-white">
              갤러리 들어가기 <span className="transition group-hover:translate-x-1">→</span>
            </span>
          </div>
        </Link>
      </section>
    </main>
  );
}
