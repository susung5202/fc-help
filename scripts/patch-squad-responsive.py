from pathlib import Path

path = Path("components/SquadMaker.tsx")
text = path.read_text(encoding="utf-8")


def replace_once(before: str, after: str) -> None:
    global text
    count = text.count(before)
    if count != 1:
        raise SystemExit(f"expected one match, found {count}: {before[:80]!r}")
    text = text.replace(before, after, 1)


replace_once(
    '''  return (\n    <div className="mt-8">\n      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#181b21] p-5 lg:flex-row lg:items-center lg:justify-between">''',
    '''  return (\n    <div className="mt-0 md:mt-8">\n      <div className="border-b border-white/10 bg-[#111318] px-2 py-2 md:hidden">\n        <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-2">\n          <div className="flex h-11 items-center justify-center rounded-xl border border-lime-400/25 bg-lime-400/[0.06] text-sm font-black tracking-tight text-white">\n            FC<span className="text-lime-400">H</span>\n          </div>\n          <label className="flex h-11 items-center rounded-xl border border-white/15 bg-[#202522] px-3">\n            <span className="sr-only">포메이션</span>\n            <select\n              value={formationKey}\n              onChange={(event) => handleFormationChange(event.target.value)}\n              className="h-full w-full bg-transparent text-[15px] font-black text-white outline-none"\n            >\n              {Object.keys(FORMATIONS).map((key) => (\n                <option key={key} value={key} className="bg-[#181b21]">\n                  {key}\n                </option>\n              ))}\n            </select>\n          </label>\n        </div>\n\n        <div className="mt-1.5 grid grid-cols-3 gap-1.5">\n          <div className="flex h-10 items-center justify-center rounded-xl border border-white/10 bg-[#202522] px-2 text-[11px] font-bold text-gray-400">\n            자동 저장\n          </div>\n          <button\n            type="button"\n            onClick={resetCurrentPositions}\n            className="h-10 rounded-xl border border-white/10 bg-[#202522] px-2 text-[11px] font-bold text-gray-200 active:bg-white/10"\n          >\n            위치 초기화\n          </button>\n          <button\n            type="button"\n            onClick={clearSquad}\n            className="h-10 rounded-xl border border-red-400/20 bg-[#202522] px-2 text-[11px] font-bold text-red-300 active:bg-red-400/10"\n          >\n            전체 초기화\n          </button>\n        </div>\n      </div>\n\n      <div className="hidden flex-col gap-4 rounded-2xl border border-white/10 bg-[#181b21] p-5 md:flex lg:flex-row lg:items-center lg:justify-between">''',
)

replace_once(
    '''      <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,760px)_410px] xl:justify-center">\n        <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#101b14] p-3 sm:p-5">\n          <div\n            ref={pitchRef}\n            className="relative mx-auto aspect-[0.7] w-full max-w-[600px] overflow-hidden rounded-2xl border-2 border-white/25 bg-[repeating-linear-gradient(180deg,#17612d_0%,#17612d_16.66%,#135526_16.66%,#135526_33.33%)] shadow-inner shadow-black/40"''',
    '''      <div className="mt-1 grid gap-6 md:mt-4 xl:grid-cols-[minmax(0,760px)_410px] xl:justify-center">\n        <div className="overflow-hidden border-y border-white/10 bg-[#101b14] p-1 md:rounded-3xl md:border md:p-5">\n          <div\n            ref={pitchRef}\n            className="relative mx-auto aspect-[0.7] w-full max-w-[600px] overflow-hidden rounded-xl border border-white/25 bg-[repeating-linear-gradient(180deg,#17612d_0%,#17612d_16.66%,#135526_16.66%,#135526_33.33%)] shadow-inner shadow-black/40 md:rounded-2xl md:border-2"''',
)

replace_once(
    '''            <div className="pointer-events-none absolute left-2 top-2 z-40 rounded-xl bg-black/60 px-2.5 py-1.5 backdrop-blur sm:left-3 sm:top-3 sm:px-3 sm:py-2">\n              <span className="text-[10px] text-gray-300 sm:text-xs">가치 </span>\n              <span className="text-sm font-black text-white sm:text-base">{formatSquadPrice(totalPrice)}</span>\n            </div>\n            <div className="pointer-events-none absolute right-2 top-2 z-40 rounded-xl bg-black/60 px-2.5 py-1.5 text-right backdrop-blur sm:right-3 sm:top-3 sm:px-3 sm:py-2">\n              <span className="text-[10px] text-gray-300 sm:text-xs">급여 </span>\n              <span className="text-sm font-black text-white sm:text-base">{totalSalary}</span>\n              <span className="text-[10px] text-gray-300 sm:text-xs">/310</span>\n            </div>''',
    '''            <div className="pointer-events-none absolute left-2 top-2 z-40 rounded-lg bg-black/60 px-2 py-1 backdrop-blur md:left-3 md:top-3 md:rounded-xl md:px-3 md:py-2">\n              <span className="text-[9px] text-gray-300 md:text-xs">가치 </span>\n              <span className="text-[12px] font-black text-white md:text-base">{formatSquadPrice(totalPrice)}</span>\n            </div>\n            <div className="pointer-events-none absolute right-2 top-2 z-40 rounded-lg bg-black/60 px-2 py-1 text-right backdrop-blur md:right-3 md:top-3 md:rounded-xl md:px-3 md:py-2">\n              <span className="text-[9px] text-gray-300 md:text-xs">급여 </span>\n              <span className="text-[12px] font-black text-white md:text-base">{totalSalary}</span>\n              <span className="text-[9px] text-gray-300 md:text-xs">/310</span>\n            </div>''',
)

replace_once(
    '''        <div\n          className={`flex h-[58px] w-[72px] items-center justify-center rounded-xl border bg-black/40 shadow-lg backdrop-blur-sm transition sm:h-[70px] sm:w-[88px] ${''',
    '''        <div\n          className={`flex h-[50px] w-[62px] items-center justify-center rounded-lg border bg-black/40 shadow-lg backdrop-blur-sm transition md:h-[70px] md:w-[88px] md:rounded-xl ${''',
)

replace_once(
    '''          <span className="text-3xl font-light leading-none text-white/90 sm:text-4xl">+</span>''',
    '''          <span className="text-2xl font-light leading-none text-white/90 md:text-4xl">+</span>''',
)

path.write_text(text, encoding="utf-8")
