from pathlib import Path


def replace_once(text: str, before: str, after: str) -> str:
    count = text.count(before)
    if count != 1:
        raise SystemExit(f"expected one match, found {count}: {before[:90]!r}")
    return text.replace(before, after, 1)


maker_path = Path("components/SquadMaker.tsx")
text = maker_path.read_text(encoding="utf-8")

text = replace_once(
    text,
    '''  function resetCurrentPositions() {\n    dragStateRef.current = null;\n    setDraggingSlotId(null);\n    setDropTargetSlotId(null);\n    setDragPosition(null);\n  }\n\n''',
    '''''',
)

text = replace_once(
    text,
    '''  return (\n    <div className="mt-8">\n      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#181b21] p-5 lg:flex-row lg:items-center lg:justify-between">''',
    '''  return (\n    <div className="mt-0 md:mt-8">\n      <div className="border-b border-white/10 bg-[#111318] px-2 py-2 md:hidden">\n        <div className="grid grid-cols-[42px_minmax(0,1fr)] gap-2">\n          <div className="flex h-10 items-center justify-center rounded-lg border border-lime-400/25 bg-lime-400/[0.06] text-[12px] font-black tracking-tight text-white">\n            FC<span className="text-lime-400">H</span>\n          </div>\n          <label className="flex h-10 items-center rounded-lg border border-white/15 bg-[#202522] px-3">\n            <span className="sr-only">포메이션</span>\n            <select\n              value={formationKey}\n              onChange={(event) => handleFormationChange(event.target.value)}\n              className="h-full w-full bg-transparent text-[14px] font-black text-white outline-none"\n            >\n              {Object.keys(FORMATIONS).map((key) => (\n                <option key={key} value={key} className="bg-[#181b21]">\n                  {key}\n                </option>\n              ))}\n            </select>\n          </label>\n        </div>\n        <button\n          type="button"\n          onClick={clearSquad}\n          className="mt-1.5 h-9 w-full rounded-lg border border-red-400/20 bg-[#202522] px-3 text-[11px] font-bold text-red-300 active:bg-red-400/10"\n        >\n          전체 초기화\n        </button>\n      </div>\n\n      <div className="hidden flex-col gap-4 rounded-2xl border border-white/10 bg-[#181b21] p-5 md:flex lg:flex-row lg:items-center lg:justify-between">''',
)

text = replace_once(
    text,
    '''          <button\n            type="button"\n            onClick={resetCurrentPositions}\n            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-gray-300 transition hover:bg-white/5"\n          >\n            위치 초기화\n          </button>\n''',
    '''''',
)

text = replace_once(
    text,
    '''      <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,760px)_410px] xl:justify-center">\n        <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#101b14] p-3 sm:p-5">\n          <div\n            ref={pitchRef}\n            className="relative mx-auto aspect-[0.7] w-full max-w-[600px] overflow-hidden rounded-2xl border-2 border-white/25 bg-[repeating-linear-gradient(180deg,#17612d_0%,#17612d_16.66%,#135526_16.66%,#135526_33.33%)] shadow-inner shadow-black/40"''',
    '''      <div className="mt-1 grid gap-6 md:mt-4 xl:grid-cols-[minmax(0,760px)_410px] xl:justify-center">\n        <div className="overflow-hidden border-y border-white/10 bg-[#101b14] p-0.5 md:rounded-3xl md:border md:p-5">\n          <div\n            ref={pitchRef}\n            className="relative mx-auto aspect-[0.7] w-full max-w-[600px] overflow-hidden rounded-lg border border-white/25 bg-[repeating-linear-gradient(180deg,#17612d_0%,#17612d_16.66%,#135526_16.66%,#135526_33.33%)] shadow-inner shadow-black/40 md:rounded-2xl md:border-2"''',
)

text = replace_once(
    text,
    '''            <div className="pointer-events-none absolute left-2 top-2 z-40 rounded-xl bg-black/60 px-2.5 py-1.5 backdrop-blur sm:left-3 sm:top-3 sm:px-3 sm:py-2">\n              <span className="text-[10px] text-gray-300 sm:text-xs">가치 </span>\n              <span className="text-sm font-black text-white sm:text-base">{formatSquadPrice(totalPrice)}</span>\n            </div>\n            <div className="pointer-events-none absolute right-2 top-2 z-40 rounded-xl bg-black/60 px-2.5 py-1.5 text-right backdrop-blur sm:right-3 sm:top-3 sm:px-3 sm:py-2">\n              <span className="text-[10px] text-gray-300 sm:text-xs">급여 </span>\n              <span className="text-sm font-black text-white sm:text-base">{totalSalary}</span>\n              <span className="text-[10px] text-gray-300 sm:text-xs">/310</span>\n            </div>''',
    '''            <div className="pointer-events-none absolute left-2 top-2 z-40 rounded-lg bg-black/60 px-2 py-1 backdrop-blur sm:left-3 sm:top-3 sm:rounded-xl sm:px-3 sm:py-2">\n              <span className="text-[9px] text-gray-300 sm:text-xs">가치 </span>\n              <span className="text-[12px] font-black text-white sm:text-base">{formatSquadPrice(totalPrice)}</span>\n            </div>\n            <div className="pointer-events-none absolute right-2 top-2 z-40 rounded-lg bg-black/60 px-2 py-1 text-right backdrop-blur sm:right-3 sm:top-3 sm:rounded-xl sm:px-3 sm:py-2">\n              <span className="text-[9px] text-gray-300 sm:text-xs">급여 </span>\n              <span className="text-[12px] font-black text-white sm:text-base">{totalSalary}</span>\n              <span className="text-[9px] text-gray-300 sm:text-xs">/310</span>\n            </div>''',
)

text = replace_once(
    text,
    '''        <div\n          className={`flex h-[58px] w-[72px] items-center justify-center rounded-xl border bg-black/40 shadow-lg backdrop-blur-sm transition sm:h-[70px] sm:w-[88px] ${''',
    '''        <div\n          className={`flex h-[48px] w-[60px] items-center justify-center rounded-lg border bg-black/40 shadow-lg backdrop-blur-sm transition sm:h-[70px] sm:w-[88px] sm:rounded-xl ${''',
)

text = replace_once(
    text,
    '''          <span className="text-3xl font-light leading-none text-white/90 sm:text-4xl">+</span>''',
    '''          <span className="text-2xl font-light leading-none text-white/90 sm:text-4xl">+</span>''',
)

maker_path.write_text(text, encoding="utf-8")


card_path = Path("components/SquadPlayerCard.tsx")
card = card_path.read_text(encoding="utf-8")

replacements = [
    ('className="flex h-7 w-7 items-center justify-center bg-[#d8c994] text-[13px] font-black text-[#302c1d] sm:h-9 sm:w-9 sm:text-base"',
     'className="flex h-5 w-5 items-center justify-center bg-[#d8c994] text-[10px] font-black text-[#302c1d] sm:h-9 sm:w-9 sm:text-base"'),
    ('className="relative flex h-7 w-7 items-center justify-center bg-white/85 sm:h-10 sm:w-10"',
     'className="relative flex h-5 w-5 items-center justify-center bg-white/85 sm:h-10 sm:w-10"'),
    ('className="relative z-10 text-[10px] font-black text-white sm:text-sm"',
     'className="relative z-10 text-[8px] font-black text-white sm:text-sm"'),
    ('className={`relative h-[112px] w-[76px] transition sm:h-[156px] sm:w-[116px] ${',
     'className={`relative h-[94px] w-[64px] transition sm:h-[156px] sm:w-[116px] ${'),
    ('className="h-6 w-6 object-contain sm:h-9 sm:w-9"',
     'className="h-5 w-5 object-contain sm:h-9 sm:w-9"'),
    ('className="absolute left-0 top-[26px] z-30 flex flex-col items-start sm:top-[39px]"',
     'className="absolute left-0 top-[21px] z-30 flex flex-col items-start sm:top-[39px]"'),
    ('text-[10px] font-black leading-none sm:text-base',
     'text-[8px] font-black leading-none sm:text-base'),
    ('className="mt-0.5 text-[17px] font-black leading-none text-white sm:text-[27px]"',
     'className="mt-0.5 text-[14px] font-black leading-none text-white sm:text-[27px]"'),
    ('className="absolute bottom-[31px] left-0 z-30 h-4 max-w-7 object-contain sm:bottom-[42px] sm:h-6 sm:max-w-10"',
     'className="absolute bottom-[25px] left-0 z-30 h-3.5 max-w-6 object-contain sm:bottom-[42px] sm:h-6 sm:max-w-10"'),
    ('className={`flex h-6 w-6 items-center justify-center rounded-[2px] border-2 p-0 text-[11px] font-black leading-none sm:h-8 sm:w-8 sm:text-[14px] ${getEnhancementBadgeTone(grade)}`}',
     'className={`flex h-5 w-5 items-center justify-center rounded-[2px] border p-0 text-[9px] font-black leading-none sm:h-8 sm:w-8 sm:border-2 sm:text-[14px] ${getEnhancementBadgeTone(grade)}`}'),
    ('className="pointer-events-none absolute bottom-[28px] left-1/2 z-10 max-h-[82px] max-w-[150%] -translate-x-1/2 object-contain sm:bottom-[39px] sm:max-h-[120px]"',
     'className="pointer-events-none absolute bottom-[22px] left-1/2 z-10 max-h-[66px] max-w-[142%] -translate-x-1/2 object-contain sm:bottom-[39px] sm:max-h-[120px] sm:max-w-[150%]"'),
    ('className="absolute inset-x-[-8px] bottom-0 z-40 text-center sm:inset-x-[-10px]"',
     'className="absolute inset-x-[-5px] bottom-0 z-40 text-center sm:inset-x-[-10px]"'),
    ('className="truncate text-[10px] font-black leading-none text-white sm:text-[14px]"',
     'className="truncate text-[8px] font-black leading-none text-white sm:text-[14px]"'),
    ('className="mt-1 truncate text-[8px] font-black leading-none text-amber-300 sm:mt-1.5 sm:text-[11px]"',
     'className="mt-0.5 truncate text-[7px] font-black leading-none text-amber-300 sm:mt-1.5 sm:text-[11px]"'),
]

for before, after in replacements:
    card = replace_once(card, before, after)

card_path.write_text(card, encoding="utf-8")
