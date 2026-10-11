import Link from "next/link";

type Section = "players" | "refresh" | "community" | "gallery";

const notes: Record<Section, { title: string; intro: string; steps: { title: string; body: string }[] }> = {
  players: {
    title: "선수 정보를 비교할 때 확인할 사항",
    intro: "같은 선수 이름이라도 시즌과 강화 단계에 따라 비교 조건이 달라집니다. 검색 결과를 해석할 때 아래 항목을 함께 살펴보세요.",
    steps: [
      { title: "시즌을 먼저 확인", body: "검색 결과의 시즌 표기를 확인하고, 비교하려는 선수 카드가 같은 시즌인지 구분합니다." },
      { title: "OVR은 참고 지표", body: "OVR 정렬은 전체 능력치를 빠르게 살펴보는 기능입니다. 실제 활용은 포지션과 팀 구성에 따라 달라질 수 있습니다." },
      { title: "최신 게임 정보 확인", body: "FC 온라인의 데이터는 업데이트될 수 있으므로 게임 내 표시와 차이가 있다면 게임 내 정보를 우선해 주세요." },
    ],
  },
  refresh: {
    title: "갱신시간 정보를 읽는 방법",
    intro: "표시되는 갱신시간은 공개 참고값과 이용자 제보를 토대로 정리한 정보입니다. 특정 선수의 거래가 반드시 그 시각에 성사된다는 뜻은 아닙니다.",
    steps: [
      { title: "시간 구분 확인", body: "홀수시, 짝수시 또는 매시간 구분과 분 단위 정보를 함께 확인해 주세요." },
      { title: "제보의 한계 이해", body: "갱신은 예측과 다르게 발생할 수 있으며 제보가 적거나 오래된 경우 정확도가 낮을 수 있습니다." },
      { title: "알림은 보조 기능", body: "브라우저 알림은 확인 시점을 알려주기 위한 기능입니다. 기기 설정과 네트워크 상태에 따라 수신이 늦어질 수 있습니다." },
    ],
  },
  community: {
    title: "커뮤니티 이용 안내",
    intro: "질문을 올리거나 다른 구단주의 경험을 참고할 때는 게시글의 맥락과 작성 시점을 함께 확인해 주세요.",
    steps: [
      { title: "카테고리 선택", body: "일반 대화는 자유, 도움 요청은 질문, 경험을 정리한 글은 팁·정보, 선수 배치 관련 내용은 스쿼드 카테고리를 이용할 수 있습니다." },
      { title: "정보를 공유할 때", body: "선수 시즌, 강화 단계, 포메이션 등 상황을 구체적으로 적으면 다른 이용자가 이해하기 쉽습니다." },
      { title: "정보의 정확성", body: "이용자 게시글은 공식 게임 공지가 아닙니다. 시세나 업데이트 등 중요한 내용은 게임 내 정보와 공식 안내를 다시 확인해 주세요." },
    ],
  },
  gallery: {
    title: "스쿼드 갤러리 활용 안내",
    intro: "갤러리에서 공개된 스쿼드를 탐색하고, 원하는 구성을 참고해 나만의 스쿼드를 만들 수 있습니다.",
    steps: [
      { title: "비교 기준 설정", body: "포메이션과 팀컬러, 포함 선수 또는 선수 가치 범위를 기준으로 스쿼드를 비교해 보세요." },
      { title: "복사한 뒤 조정", body: "다른 이용자의 스쿼드를 그대로 사용하기보다 선호하는 포지션과 예산에 맞춰 변경해 보는 것이 좋습니다." },
      { title: "표시 정보 확인", body: "갤러리에 등록된 구성과 값은 작성 시점 기준일 수 있으며 실제 게임 내 상태와 차이가 있을 수 있습니다." },
    ],
  },
};

export default function ServiceUsageNotes({ section }: { section: Section }) {
  const note = notes[section];

  return (
    <section aria-labelledby={`usage-notes-${section}`} className="mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6">
      <div className="rounded-2xl border border-white/10 bg-[#15191d] p-5 sm:p-7">
        <p className="text-xs font-black tracking-[0.16em] text-lime-300">FC HELP · 이용 안내</p>
        <h2 id={`usage-notes-${section}`} className="mt-3 text-xl font-black text-white sm:text-2xl">{note.title}</h2>
        <p className="mt-3 max-w-4xl text-sm leading-7 text-gray-300">{note.intro}</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {note.steps.map((step) => (
            <div key={step.title} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
              <h3 className="text-sm font-bold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-400">{step.body}</p>
            </div>
          ))}
        </div>
        <Link href="/guide" className="mt-6 inline-block text-sm font-bold text-lime-300 hover:text-lime-200">
          FC Help 정보 활용 가이드 더 보기 →
        </Link>
      </div>
    </section>
  );
}
