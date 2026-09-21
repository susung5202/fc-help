from pathlib import Path

path = Path('components/SquadMaker.tsx')
text = path.read_text()
old = '''                    <div className="flex shrink-0 items-center gap-2">
                      <select
                        value={selectedGrade}
                        onChange={(event) => {
                          const nextGrade = Number(event.target.value);
                          setResultGrades((current) => ({ ...current, [player.id]: nextGrade }));
                        }}
                        className={`h-8 w-[58px] rounded-lg border px-1 text-center text-[11px] font-black outline-none ${getEnhancementBadgeTone(selectedGrade)}`}
                        aria-label={`${player.name} 강화 단계 선택`}
                      >
                        {Array.from({ length: 13 }, (_, index) => index + 1).map((level) => (
                          <option key={`${player.id}-grade-${level}`} value={level} className="bg-[#151a18] text-white">
                            {level}강
                          </option>
                        ))}
                      </select>
                      <div className="w-9 text-right">
                        <p className="text-lg font-black text-lime-300">{player.ovr ?? "-"}</p>
                        <p className="text-[10px] font-bold text-gray-500">{player.position ?? "OVR"}</p>
                      </div>
                    </div>
'''
new = '''                    <div className="flex shrink-0 items-center gap-2">
                      <details className="group relative">
                        <summary
                          className={`flex h-8 min-w-[54px] cursor-pointer list-none items-center justify-between gap-1 rounded-md border px-2 text-[11px] font-black outline-none [&::-webkit-details-marker]:hidden ${getEnhancementBadgeTone(selectedGrade)}`}
                          aria-label={`${player.name} 강화 단계 선택`}
                        >
                          <span>{selectedGrade}</span>
                          <span className="text-[9px] opacity-80 transition group-open:rotate-180">▼</span>
                        </summary>
                        <div className="absolute right-0 top-full z-50 mt-1 grid w-[116px] grid-cols-2 overflow-hidden rounded-lg border border-white/15 bg-[#20242a] shadow-2xl">
                          {Array.from({ length: 13 }, (_, index) => index + 1).map((level) => (
                            <button
                              key={`${player.id}-grade-${level}`}
                              type="button"
                              onClick={(event) => {
                                setResultGrades((current) => ({ ...current, [player.id]: level }));
                                const details = event.currentTarget.closest('details');
                                if (details) details.removeAttribute('open');
                              }}
                              className={`h-9 border border-black/15 text-sm font-black transition hover:brightness-110 ${getEnhancementBadgeTone(level)} ${selectedGrade === level ? 'ring-2 ring-inset ring-lime-200' : ''}`}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                      </details>
                      <div className="w-11 text-right">
                        <p className="text-lg font-black text-lime-300">{player.ovr ?? "-"}</p>
                        <p className="text-[10px] font-bold text-gray-500">{player.position ?? "OVR"}</p>
                        <p className="mt-0.5 text-[10px] font-black text-gray-300">급여 {details?.salary ?? "-"}</p>
                      </div>
                    </div>
'''
if old not in text:
    raise SystemExit('target block not found')
path.write_text(text.replace(old, new))
