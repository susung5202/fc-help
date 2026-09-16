from pathlib import Path

p = Path("components/SquadMaker.tsx")
s = p.read_text()

s = s.replace(
    'import SquadPlayerCard from "@/components/SquadPlayerCard";\n',
    'import PlayerArtwork from "@/components/PlayerArtwork";\nimport SquadPlayerCard from "@/components/SquadPlayerCard";\n',
)

s = s.replace(
    'type SquadPlayer = SearchPlayer & {\n  grade: number;\n};',
    'type SquadPlayer = SearchPlayer & {\n  grade: number;\n  artworkSpid?: number;\n};\n\ntype SquadCardDetails = {\n  salary: number | null;\n  prices: Array<string | null>;\n};\n\ntype PlayerVariant = SearchPlayer & {\n  salary: number | null;\n};',
)

s = s.replace(
    'const STORAGE_KEY = "fc-help-squad-v1";\n',
    '''const STORAGE_KEY = "fc-help-squad-v1";
const SUMMARY_CARD_CACHE = new Map<string, SquadCardDetails>();

function isGoalkeeperSlot(label: string) {
  return label === "GK";
}

function isGoalkeeperPlayer(player: SearchPlayer | SquadPlayer) {
  return player.position === "GK";
}

function addDecimalStrings(left: string, right: string) {
  const a = left.replace(/^0+(?=\\d)/, "") || "0";
  const b = right.replace(/^0+(?=\\d)/, "") || "0";
  let carry = 0;
  let result = "";
  let i = a.length - 1;
  let j = b.length - 1;

  while (i >= 0 || j >= 0 || carry) {
    const sum = (i >= 0 ? Number(a[i--]) : 0) + (j >= 0 ? Number(b[j--]) : 0) + carry;
    result = String(sum % 10) + result;
    carry = Math.floor(sum / 10);
  }
  return result.replace(/^0+(?=\\d)/, "") || "0";
}

function formatSquadPrice(value: string) {
  const digits = value.replace(/^0+(?=\\d)/, "") || "0";
  if (digits === "0") return "0";
  if (digits.length <= 8) return Number(digits).toLocaleString("ko-KR");

  const labels = ["", "만", "억", "조", "경", "해"];
  const padLength = Math.ceil(digits.length / 4) * 4;
  const groups = digits.padStart(padLength, "0").match(/.{4}/g) ?? [];
  const parts: string[] = [];
  groups.forEach((group, index) => {
    const amount = Number(group);
    if (!amount) return;
    const unitIndex = groups.length - index - 1;
    parts.push(`${amount.toLocaleString("ko-KR")}${labels[unitIndex] ?? ""}`);
  });
  return parts.slice(0, 2).join(" ");
}
''',
)

s = s.replace(
    '    newTraits: Array.isArray(player.newTraits) ? player.newTraits : [],\n',
    '    newTraits: Array.isArray(player.newTraits) ? player.newTraits : [],\n    artworkSpid: player.artworkSpid ?? player.id,\n',
    1,
)

s = s.replace(
    '  const [dragPosition, setDragPosition] = useState<CustomPosition | null>(null);\n',
    '  const [dragPosition, setDragPosition] = useState<CustomPosition | null>(null);\n  const [cardDetails, setCardDetails] = useState<Record<string, SquadCardDetails>>({});\n',
)

old_results = '''        const items = (data.items ?? []) as SearchPlayer[];
        setResults(
          items.map((player) => ({
            ...player,
            newTraits: Array.isArray(player.newTraits) ? player.newTraits : [],
          }))
        );'''
new_results = '''        const items = (data.items ?? []) as SearchPlayer[];
        const targetSlot = formation.slots.find((slot) => slot.slotId === selectedSlotId);
        const goalkeeperOnly = targetSlot ? isGoalkeeperSlot(targetSlot.label) : false;
        setResults(
          items
            .filter((player) =>
              goalkeeperOnly ? isGoalkeeperPlayer(player) : !isGoalkeeperPlayer(player)
            )
            .map((player) => ({
              ...player,
              newTraits: Array.isArray(player.newTraits) ? player.newTraits : [],
            }))
        );'''
if old_results not in s:
    raise SystemExit("search result block not found")
s = s.replace(old_results, new_results)
s = s.replace('  }, [query, selectedSlotId]);', '  }, [query, selectedSlotId, formationKey]);', 1)

marker = '''  const selectedPlayers = Object.values(players) as SquadPlayer[];
  const averageOvr = useMemo(() => {'''
replacement = '''  useEffect(() => {
    const controller = new AbortController();
    const entries = Object.entries(players);
    if (entries.length === 0) {
      setCardDetails({});
      return () => controller.abort();
    }

    void Promise.all(
      entries.map(async ([slotId, player]) => {
        const slot = formation.slots.find((item) => item.slotId === slotId);
        if (!slot) return [slotId, null] as const;
        const cacheKey = `${player.id}:${slot.label}`;
        const cached = SUMMARY_CARD_CACHE.get(cacheKey);
        if (cached) return [slotId, cached] as const;

        try {
          const response = await fetch(
            `/api/squad/card?spid=${player.id}&name=${encodeURIComponent(player.name)}&position=${encodeURIComponent(slot.label)}`,
            { signal: controller.signal }
          );
          if (!response.ok) return [slotId, null] as const;
          const data = await response.json();
          const details: SquadCardDetails = {
            salary: Number.isFinite(data.salary) ? data.salary : null,
            prices: Array.isArray(data.prices) ? data.prices : [],
          };
          SUMMARY_CARD_CACHE.set(cacheKey, details);
          return [slotId, details] as const;
        } catch {
          return [slotId, null] as const;
        }
      })
    ).then((items) => {
      if (controller.signal.aborted) return;
      setCardDetails(
        Object.fromEntries(items.filter((item): item is readonly [string, SquadCardDetails] => item[1] !== null))
      );
    });

    return () => controller.abort();
  }, [players, formationKey]);

  const selectedPlayers = Object.values(players) as SquadPlayer[];
  const totalSalary = Object.entries(players).reduce(
    (sum, [slotId]) => sum + (cardDetails[slotId]?.salary ?? 0),
    0
  );
  const totalPrice = Object.entries(players).reduce((sum, [slotId, player]) => {
    const price = cardDetails[slotId]?.prices?.[player.grade - 1];
    return price && /^\\d+$/.test(price) ? addDecimalStrings(sum, price) : sum;
  }, "0");

  const averageOvr = useMemo(() => {'''
if marker not in s:
    raise SystemExit("selected players marker not found")
s = s.replace(marker, replacement)

old_choose = '''  function choosePlayer(player: SearchPlayer) {
    if (!selectedSlotId) return;

    setPlayers((current) => ({
      ...current,
      [selectedSlotId]: {
        ...player,
        newTraits: player.newTraits ?? [],
        grade,
      },
    }));

    closePanel();
  }'''
new_choose = '''  function choosePlayer(player: SearchPlayer) {
    if (!selectedSlotId || !selectedSlot) return;
    if (isGoalkeeperSlot(selectedSlot.label) !== isGoalkeeperPlayer(player)) return;

    setPlayers((current) => ({
      ...current,
      [selectedSlotId]: {
        ...player,
        newTraits: player.newTraits ?? [],
        grade,
        artworkSpid: player.id,
      },
    }));

    closePanel();
  }

  function changeCurrentSeason(variant: PlayerVariant) {
    if (!selectedSlotId || !selectedSlot) return;
    if (isGoalkeeperSlot(selectedSlot.label) !== isGoalkeeperPlayer(variant)) return;

    setPlayers((current) => {
      const previous = current[selectedSlotId];
      if (!previous) return current;
      return {
        ...current,
        [selectedSlotId]: {
          id: variant.id,
          name: variant.name,
          seasonName: variant.seasonName,
          seasonImg: variant.seasonImg,
          ovr: variant.ovr,
          position: variant.position,
          newTraits: variant.newTraits ?? [],
          grade: previous.grade,
          artworkSpid: variant.id,
        },
      };
    });
  }

  function changeCurrentArtwork(spid: number) {
    if (!selectedSlotId) return;
    setPlayers((current) => {
      const player = current[selectedSlotId];
      if (!player) return current;
      return { ...current, [selectedSlotId]: { ...player, artworkSpid: spid } };
    });
  }'''
if old_choose not in s:
    raise SystemExit("choose player block not found")
s = s.replace(old_choose, new_choose)

s = s.replace(
    '  function findDropTarget(clientX: number, clientY: number, rect: DOMRect): Slot | null {',
    '  function findDropTarget(clientX: number, clientY: number, rect: DOMRect, sourceSlotId?: string): Slot | null {',
)
s = s.replace(
    '    let best: { slot: Slot; distance: number } | null = null;\n\n    for (const slot of formation.slots) {',
    '    let best: { slot: Slot; distance: number } | null = null;\n    const sourceSlot = sourceSlotId\n      ? formation.slots.find((slot) => slot.slotId === sourceSlotId) ?? null\n      : null;\n\n    for (const slot of formation.slots) {\n      if (sourceSlot && isGoalkeeperSlot(sourceSlot.label) !== isGoalkeeperSlot(slot.label)) continue;',
)
s = s.replace(
    'findDropTarget(event.clientX, event.clientY, rect);',
    'findDropTarget(event.clientX, event.clientY, rect, slotId);',
)
s = s.replace(
    'findDropTarget(drag.latestClientX, drag.latestClientY, rect)',
    'findDropTarget(drag.latestClientX, drag.latestClientY, rect, slotId)',
)

old_panel_props = '''      onGradeChange={updateCurrentGrade}
      onChoose={choosePlayer}
      onRemove={removeCurrentPlayer}
      onClose={closePanel}'''
new_panel_props = '''      onGradeChange={updateCurrentGrade}
      onChoose={choosePlayer}
      onSeasonChange={changeCurrentSeason}
      onArtworkChange={changeCurrentArtwork}
      onRemove={removeCurrentPlayer}
      onClose={closePanel}'''
if old_panel_props not in s:
    raise SystemExit("panel props block not found")
s = s.replace(old_panel_props, new_panel_props)

start = s.find('      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">')
if start >= 0:
    end = s.find('      </div>\n\n      <div className="mt-6 grid', start)
    if end < 0:
        raise SystemExit("instruction chips end not found")
    s = s[:start] + '      <div className="mt-4 grid' + s[end + len('      </div>\n\n      <div className="mt-6 grid'):]

s = s.replace(
    '<SummaryBadge label="평균 OVR" value={averageOvr === null ? "-" : String(averageOvr)} />',
    '<SummaryBadge label="평균 OVR" value={averageOvr === null ? "-" : String(averageOvr)} />\n          <SummaryBadge label="총 급여" value={`${totalSalary}/310`} />\n          <SummaryBadge label="총 가격" value={formatSquadPrice(totalPrice)} />',
)

old_overlays = '''            <div className="pointer-events-none absolute left-3 top-3 z-40 rounded-xl bg-black/60 px-3 py-2 backdrop-blur md:hidden">
              <p className="text-[9px] font-bold text-gray-400">선수</p>
              <p className="text-sm font-black text-white">{selectedPlayers.length}/11</p>
            </div>
            <div className="pointer-events-none absolute right-3 top-3 z-40 rounded-xl bg-black/60 px-3 py-2 text-right backdrop-blur md:hidden">
              <p className="text-[9px] font-bold text-gray-400">평균 OVR</p>
              <p className="text-sm font-black text-white">{averageOvr === null ? "-" : averageOvr}</p>
            </div>'''
new_overlays = '''            <div className="pointer-events-none absolute left-2 top-2 z-40 rounded-xl bg-black/60 px-2.5 py-1.5 backdrop-blur sm:left-3 sm:top-3 sm:px-3 sm:py-2">
              <span className="text-[10px] text-gray-300 sm:text-xs">가치 </span>
              <span className="text-sm font-black text-white sm:text-base">{formatSquadPrice(totalPrice)}</span>
            </div>
            <div className="pointer-events-none absolute right-2 top-2 z-40 rounded-xl bg-black/60 px-2.5 py-1.5 text-right backdrop-blur sm:right-3 sm:top-3 sm:px-3 sm:py-2">
              <span className="text-[10px] text-gray-300 sm:text-xs">급여 </span>
              <span className="text-sm font-black text-white sm:text-base">{totalSalary}</span>
              <span className="text-[10px] text-gray-300 sm:text-xs">/310</span>
            </div>'''
if old_overlays not in s:
    raise SystemExit("pitch overlays block not found")
s = s.replace(old_overlays, new_overlays)

s = s.replace(
    '          spid={player.id}\n          name={player.name}',
    '          spid={player.id}\n          artworkSpid={player.artworkSpid}\n          name={player.name}',
)

s = s.replace(
    '<div className="fixed inset-0 z-50 flex items-end bg-black/70 px-3 pt-10 xl:hidden">\n          <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl">{panel}</div>\n        </div>',
    '<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 xl:hidden">\n          <div className="max-h-[92vh] w-full max-w-[540px] overflow-y-auto">{panel}</div>\n        </div>',
)

func_start = s.find("function PlayerPickerPanel({")
if func_start < 0:
    raise SystemExit("PlayerPickerPanel not found")

new_func = r'''function PlayerPickerPanel({
  slot,
  currentPlayer,
  query,
  onQueryChange,
  results,
  loading,
  error,
  grade,
  onGradeChange,
  onChoose,
  onSeasonChange,
  onArtworkChange,
  onRemove,
  onClose,
}: {
  slot: Slot;
  currentPlayer: SquadPlayer | null;
  query: string;
  onQueryChange: (value: string) => void;
  results: SearchPlayer[];
  loading: boolean;
  error: string;
  grade: number;
  onGradeChange: (grade: number) => void;
  onChoose: (player: SearchPlayer) => void;
  onSeasonChange: (variant: PlayerVariant) => void;
  onArtworkChange: (spid: number) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [replaceMode, setReplaceMode] = useState(!currentPlayer);
  const [variants, setVariants] = useState<PlayerVariant[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);

  useEffect(() => {
    setReplaceMode(!currentPlayer);
    if (!currentPlayer) {
      setVariants([]);
      return;
    }

    const controller = new AbortController();
    setVariantsLoading(true);
    fetch(`/api/squad/variants?spid=${currentPlayer.id}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return { variants: [] };
        return response.json();
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        const items = Array.isArray(data.variants) ? (data.variants as PlayerVariant[]) : [];
        const goalkeeperSlot = isGoalkeeperSlot(slot.label);
        setVariants(
          items.filter((variant) =>
            goalkeeperSlot ? isGoalkeeperPlayer(variant) : !isGoalkeeperPlayer(variant)
          )
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setVariants([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setVariantsLoading(false);
      });

    return () => controller.abort();
  }, [currentPlayer?.id, slot.label]);

  const currentVariant = currentPlayer
    ? variants.find((variant) => variant.id === currentPlayer.id) ?? null
    : null;
  const currentSalary = currentVariant?.salary ?? null;

  function salaryDiff(variant: PlayerVariant) {
    if (variant.salary == null || currentSalary == null) return "-";
    const diff = variant.salary - currentSalary;
    return diff > 0 ? `+${diff}` : String(diff);
  }

  return (
    <div className="rounded-3xl border border-white/15 bg-[#151a18] p-5 shadow-2xl sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold text-lime-400">{slot.label}</p>
          <h2 className="truncate text-2xl font-black">
            {currentPlayer ? currentPlayer.name : "선수 선택"}
          </h2>
        </div>
        <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 text-2xl text-gray-300 hover:bg-white/10 hover:text-white">×</button>
      </div>

      <section className="mt-5">
        <p className="mb-3 text-sm font-bold text-gray-300">강화</p>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 13 }, (_, index) => index + 1).map((level) => (
            <button key={level} type="button" onClick={() => onGradeChange(level)} className={`rounded-md border py-2 text-sm font-black transition ${getEnhancementBadgeTone(level)} ${grade === level ? "ring-2 ring-lime-300" : "opacity-75 hover:opacity-100"}`}>
              {level}
            </button>
          ))}
        </div>
      </section>

      {currentPlayer && (
        <>
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-300">다른 시즌</p>
              {variantsLoading && <span className="text-[10px] text-gray-500">불러오는 중...</span>}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {variants.map((variant) => (
                <button key={variant.id} type="button" onClick={() => onSeasonChange(variant)} className={`min-w-[66px] rounded-xl border p-2 text-center transition ${variant.id === currentPlayer.id ? "border-lime-300 bg-lime-300/10" : "border-white/10 bg-black/20 hover:border-white/30"}`}>
                  <div className="flex h-10 items-center justify-center">
                    {variant.seasonImg ? <img src={variant.seasonImg} alt={variant.seasonName} className="max-h-9 max-w-12 object-contain" /> : <span className="text-xs text-gray-600">-</span>}
                  </div>
                  <p className={`mt-1 text-xs font-black ${salaryDiff(variant).startsWith("+") ? "text-rose-300" : salaryDiff(variant).startsWith("-") && salaryDiff(variant) !== "-" ? "text-sky-300" : "text-gray-300"}`}>
                    {salaryDiff(variant)}
                  </p>
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-gray-500">숫자는 현재 선택된 시즌 대비 급여 차이입니다.</p>
          </section>

          <section className="mt-6">
            <p className="mb-3 text-sm font-bold text-gray-300">이미지</p>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {variants.map((variant) => {
                const selected = (currentPlayer.artworkSpid ?? currentPlayer.id) === variant.id;
                return (
                  <button key={`art-${variant.id}`} type="button" onClick={() => onArtworkChange(variant.id)} className={`relative h-[92px] min-w-[88px] overflow-hidden rounded-2xl border bg-white/[0.03] transition ${selected ? "border-lime-300 ring-2 ring-lime-300/25" : "border-white/10 hover:border-white/30"}`} title={`${variant.seasonName} 액션샷 사용`}>
                    <PlayerArtwork spid={variant.id} alt={`${currentPlayer.name} ${variant.seasonName}`} className="absolute bottom-0 left-1/2 max-h-[88px] max-w-[135%] -translate-x-1/2 object-contain" />
                    {variant.seasonImg && <img src={variant.seasonImg} alt={variant.seasonName} className="absolute bottom-1 right-1 z-10 h-5 max-w-7 object-contain" />}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="mt-6 grid grid-cols-3 gap-2">
            <a href={`/players/${currentPlayer.id}`} className="flex items-center justify-center rounded-xl border border-white/15 py-3 text-sm font-bold text-gray-200 hover:bg-white/5">상세</a>
            <button type="button" onClick={() => setReplaceMode((value) => !value)} className="rounded-xl border border-white/15 py-3 text-sm font-bold text-gray-200 hover:bg-white/5">교체</button>
            <button type="button" onClick={onRemove} className="rounded-xl border border-red-400/30 py-3 text-sm font-bold text-red-300 hover:bg-red-400/5">제거</button>
          </div>
        </>
      )}

      {(!currentPlayer || replaceMode) && (
        <section className="mt-6 border-t border-white/10 pt-5">
          <p className="mb-2 text-sm font-bold">{currentPlayer ? "선수 교체" : "선수 검색"}</p>
          <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={slot.label === "GK" ? "골키퍼 이름 검색" : "선수 이름 검색"} autoFocus={!currentPlayer} className="w-full rounded-xl border border-white/10 bg-[#0f1115] px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-lime-400/50" />
          <div className="mt-4 max-h-[38vh] space-y-2 overflow-y-auto pr-1">
            {loading && <p className="py-8 text-center text-sm text-gray-500">선수 정보를 불러오는 중...</p>}
            {!loading && error && <p className="rounded-xl bg-red-400/5 p-4 text-sm text-red-300">{error}</p>}
            {!loading && !error && query.trim() && results.length === 0 && <p className="py-8 text-center text-sm text-gray-500">검색 결과가 없습니다.</p>}
            {!loading && !error && results.map((player) => (
              <button key={player.id} type="button" onClick={() => onChoose(player)} className="flex w-full items-start gap-3 rounded-xl border border-white/[0.08] bg-black/10 p-3 text-left transition hover:border-lime-400/30 hover:bg-lime-400/[0.04]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
                  {player.seasonImg ? <img src={player.seasonImg} alt={player.seasonName} className="max-h-9 max-w-10 object-contain" /> : <span className="text-xs text-gray-700">-</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{player.name}</p>
                  <p className="mt-1 truncate text-xs text-gray-500">{player.seasonName}</p>
                  {(player.newTraits?.length ?? 0) > 0 && <TraitChips traits={player.newTraits ?? []} compactMode />}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-black text-lime-300">{player.ovr ?? "-"}</p>
                  <p className="text-[10px] font-bold text-gray-500">{player.position ?? "OVR"}</p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
'''

s = s[:func_start] + new_func
p.write_text(s)
