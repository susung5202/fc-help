from pathlib import Path


def replace_once(text: str, before: str, after: str, label: str) -> str:
    count = text.count(before)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    return text.replace(before, after, 1)


# SquadPlayerCard: allow server-calculated OVR (grade + adaptation 5 + team color) to override local base math.
card_path = Path("components/SquadPlayerCard.tsx")
card = card_path.read_text(encoding="utf-8")
card = replace_once(
    card,
    '''  slotPosition: string;\n  grade: number;\n  newTraits: string[];''',
    '''  slotPosition: string;\n  grade: number;\n  calculatedOvr?: number | null;\n  newTraits: string[];''',
    "card prop type",
)
card = replace_once(
    card,
    '''  slotPosition,\n  grade,\n  newTraits,''',
    '''  slotPosition,\n  grade,\n  calculatedOvr,\n  newTraits,''',
    "card destructure",
)
card = replace_once(
    card,
    '''  const enhancedOvr =\n    positionOvr === null ? null : positionOvr + (ENHANCEMENT_OVR_BONUS[grade] ?? 0);''',
    '''  const enhancedOvr =\n    calculatedOvr !== null && calculatedOvr !== undefined\n      ? calculatedOvr\n      : positionOvr === null\n        ? null\n        : positionOvr + (ENHANCEMENT_OVR_BONUS[grade] ?? 0);''',
    "card calculated ovr",
)
card_path.write_text(card, encoding="utf-8")


maker_path = Path("components/SquadMaker.tsx")
text = maker_path.read_text(encoding="utf-8")

text = replace_once(
    text,
    '''type SquadCardDetails = {\n  salary: number | null;\n  prices: Array<string | null>;\n  positionOvr: number | null;\n};\n\ntype PlayerVariant = SearchPlayer & {''',
    '''type SquadCardDetails = {\n  salary: number | null;\n  prices: Array<string | null>;\n  positionOvr: number | null;\n};\n\ntype TeamColorSummary = {\n  name: string;\n  count: number;\n  level: number;\n  maxLevel: number;\n  maxRequired: number;\n  effect: string;\n  emblemUrl: string | null;\n};\n\ntype TeamColorState = {\n  adaptation: number;\n  teamColors: TeamColorSummary[];\n  ovrBySlot: Record<string, number | null>;\n  appliedBySlot: Record<string, string | null>;\n  loading: boolean;\n};\n\ntype PlayerVariant = SearchPlayer & {''',
    "maker team color types",
)

text = replace_once(
    text,
    '''function clamp(value: number, min: number, max: number) {\n  return Math.min(max, Math.max(min, value));\n}\n\nfunction withTraitDefaults(player: SquadPlayer): SquadPlayer {''',
    '''function clamp(value: number, min: number, max: number) {\n  return Math.min(max, Math.max(min, value));\n}\n\nfunction initials(value: string) {\n  const parts = value.trim().split(/\\s+/).filter(Boolean);\n  if (parts.length === 0) return "TC";\n  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();\n  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();\n}\n\nfunction inlineComputedStyles(source: Element, target: Element) {\n  if (source instanceof HTMLElement && target instanceof HTMLElement) {\n    const computed = window.getComputedStyle(source);\n    for (const property of Array.from(computed)) {\n      target.style.setProperty(\n        property,\n        computed.getPropertyValue(property),\n        computed.getPropertyPriority(property)\n      );\n    }\n  }\n\n  const sourceChildren = Array.from(source.children);\n  const targetChildren = Array.from(target.children);\n  sourceChildren.forEach((child, index) => {\n    const targetChild = targetChildren[index];\n    if (targetChild) inlineComputedStyles(child, targetChild);\n  });\n}\n\nfunction blobToDataUrl(blob: Blob) {\n  return new Promise<string>((resolve, reject) => {\n    const reader = new FileReader();\n    reader.onload = () =>\n      typeof reader.result === "string"\n        ? resolve(reader.result)\n        : reject(new Error("image conversion failed"));\n    reader.onerror = () => reject(reader.error ?? new Error("image conversion failed"));\n    reader.readAsDataURL(blob);\n  });\n}\n\nasync function imageToDataUrl(src: string) {\n  if (src.startsWith("data:")) return src;\n  const response = await fetch(`/api/squad/image-proxy?url=${encodeURIComponent(src)}`);\n  if (!response.ok) throw new Error("image proxy failed");\n  return blobToDataUrl(await response.blob());\n}\n\nfunction withTraitDefaults(player: SquadPlayer): SquadPlayer {''',
    "maker capture helpers",
)

text = replace_once(
    text,
    '''  const [dragPosition, setDragPosition] = useState<CustomPosition | null>(null);\n  const [cardDetails, setCardDetails] = useState<Record<string, SquadCardDetails>>({});\n\n  const pitchRef = useRef<HTMLDivElement>(null);''',
    '''  const [dragPosition, setDragPosition] = useState<CustomPosition | null>(null);\n  const [cardDetails, setCardDetails] = useState<Record<string, SquadCardDetails>>({});\n  const [teamColorState, setTeamColorState] = useState<TeamColorState>({\n    adaptation: 5,\n    teamColors: [],\n    ovrBySlot: {},\n    appliedBySlot: {},\n    loading: false,\n  });\n  const [savingImage, setSavingImage] = useState(false);\n\n  const pitchRef = useRef<HTMLDivElement>(null);''',
    "maker state",
)

marker = '''  }, [players, formationKey]);\n\n  const selectedPlayers = Object.values(players) as SquadPlayer[];'''
insert = '''  }, [players, formationKey]);\n\n  useEffect(() => {\n    if (!hydrated) return;\n    const entries = Object.entries(players);\n    if (entries.length === 0) {\n      setTeamColorState({\n        adaptation: 5,\n        teamColors: [],\n        ovrBySlot: {},\n        appliedBySlot: {},\n        loading: false,\n      });\n      return;\n    }\n\n    const payload = entries\n      .map(([slotId, player]) => {\n        const slot = formation.slots.find((item) => item.slotId === slotId);\n        if (!slot) return null;\n        return {\n          slotId,\n          spid: player.id,\n          position: slot.label,\n          grade: player.grade,\n        };\n      })\n      .filter((item): item is { slotId: string; spid: number; position: string; grade: number } => item !== null);\n\n    const controller = new AbortController();\n    const timer = window.setTimeout(async () => {\n      setTeamColorState((current) => ({ ...current, loading: true }));\n      try {\n        const response = await fetch("/api/squad/team-color", {\n          method: "POST",\n          headers: { "Content-Type": "application/json" },\n          body: JSON.stringify({ players: payload }),\n          signal: controller.signal,\n        });\n        if (!response.ok) throw new Error("team color request failed");\n        const data = await response.json();\n        if (controller.signal.aborted) return;\n        setTeamColorState({\n          adaptation: Number(data.adaptation) || 5,\n          teamColors: Array.isArray(data.teamColors) ? data.teamColors : [],\n          ovrBySlot:\n            data.ovrBySlot && typeof data.ovrBySlot === "object" ? data.ovrBySlot : {},\n          appliedBySlot:\n            data.appliedBySlot && typeof data.appliedBySlot === "object"\n              ? data.appliedBySlot\n              : {},\n          loading: false,\n        });\n      } catch {\n        if (controller.signal.aborted) return;\n        setTeamColorState((current) => ({ ...current, loading: false }));\n      }\n    }, 250);\n\n    return () => {\n      window.clearTimeout(timer);\n      controller.abort();\n    };\n  }, [players, formationKey, hydrated]);\n\n  const selectedPlayers = Object.values(players) as SquadPlayer[];'''
text = replace_once(text, marker, insert, "maker team color effect")

text = replace_once(
    text,
    '''      .map(([slotId, player]) => {\n        const officialSlotOvr = cardDetails[slotId]?.positionOvr;\n        if (officialSlotOvr !== null && officialSlotOvr !== undefined) {\n          return officialSlotOvr;\n        }''',
    '''      .map(([slotId, player]) => {\n        const adjustedSlotOvr = teamColorState.ovrBySlot[slotId];\n        if (adjustedSlotOvr !== null && adjustedSlotOvr !== undefined) {\n          return adjustedSlotOvr;\n        }\n\n        const officialSlotOvr = cardDetails[slotId]?.positionOvr;\n        if (officialSlotOvr !== null && officialSlotOvr !== undefined) {\n          return officialSlotOvr;\n        }''',
    "maker average ovr source",
)
text = replace_once(
    text,
    '''  }, [players, cardDetails, formation.slots]);''',
    '''  }, [players, cardDetails, formation.slots, teamColorState.ovrBySlot]);''',
    "maker average deps",
)

text = replace_once(
    text,
    '''  function handleSlotClick(slotId: string) {\n    if (skipClickRef.current === slotId) {\n      skipClickRef.current = null;\n      return;\n    }\n\n    openSlot(slotId);\n  }\n\n  const panel = selectedSlot ? (''',
    '''  function handleSlotClick(slotId: string) {\n    if (skipClickRef.current === slotId) {\n      skipClickRef.current = null;\n      return;\n    }\n\n    openSlot(slotId);\n  }\n\n  async function saveSquadImage() {\n    const pitch = pitchRef.current;\n    if (!pitch || savingImage) return;\n    setSavingImage(true);\n\n    try {\n      const rect = pitch.getBoundingClientRect();\n      const clone = pitch.cloneNode(true) as HTMLDivElement;\n      inlineComputedStyles(pitch, clone);\n      clone.querySelectorAll("[data-capture-hide='true']").forEach((element) => element.remove());\n      clone.querySelectorAll("[data-capture-tooltip='true']").forEach((element) => element.remove());\n      clone.style.width = `${rect.width}px`;\n      clone.style.height = `${rect.height}px`;\n      clone.style.maxWidth = "none";\n      clone.style.margin = "0";\n\n      const originalImages = Array.from(pitch.querySelectorAll("img"));\n      const clonedImages = Array.from(clone.querySelectorAll("img"));\n      await Promise.all(\n        clonedImages.map(async (image, index) => {\n          const source = originalImages[index];\n          if (!source?.src) return;\n          try {\n            image.src = await imageToDataUrl(source.src);\n          } catch {\n            image.remove();\n          }\n        })\n      );\n\n      const serialized = new XMLSerializer().serializeToString(clone);\n      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}" viewBox="0 0 ${rect.width} ${rect.height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${rect.width}px;height:${rect.height}px;overflow:hidden">${serialized}</div></foreignObject></svg>`;\n      const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));\n      const image = new Image();\n      await new Promise<void>((resolve, reject) => {\n        image.onload = () => resolve();\n        image.onerror = () => reject(new Error("squad image render failed"));\n        image.src = svgUrl;\n      });\n\n      const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 2));\n      const canvas = document.createElement("canvas");\n      canvas.width = Math.round(rect.width * scale);\n      canvas.height = Math.round(rect.height * scale);\n      const context = canvas.getContext("2d");\n      if (!context) throw new Error("canvas unavailable");\n      context.scale(scale, scale);\n      context.drawImage(image, 0, 0, rect.width, rect.height);\n      URL.revokeObjectURL(svgUrl);\n\n      const blob = await new Promise<Blob>((resolve, reject) =>\n        canvas.toBlob(\n          (result) => (result ? resolve(result) : reject(new Error("png export failed"))),\n          "image/png",\n          1\n        )\n      );\n      const downloadUrl = URL.createObjectURL(blob);\n      const link = document.createElement("a");\n      link.href = downloadUrl;\n      link.download = `fc-help-squad-${formationKey}-${new Date().toISOString().slice(0, 10)}.png`;\n      document.body.appendChild(link);\n      link.click();\n      link.remove();\n      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);\n    } catch (captureError) {\n      console.error("Squad image capture failed", captureError);\n      window.alert("스쿼드 이미지 저장에 실패했습니다. 잠시 후 다시 시도해주세요.");\n    } finally {\n      setSavingImage(false);\n    }\n  }\n\n  const panel = selectedSlot ? (''',
    "maker image save function",
)

text = replace_once(
    text,
    '''            <div className="pointer-events-none absolute right-2 top-2 z-40 rounded-lg bg-black/60 px-2 py-1 text-right backdrop-blur sm:right-3 sm:top-3 sm:rounded-xl sm:px-3 sm:py-2">\n              <span className="text-[9px] text-gray-300 sm:text-xs">급여 </span>\n              <span className="text-[12px] font-black text-white sm:text-base">{totalSalary}</span>\n              <span className="text-[9px] text-gray-300 sm:text-xs">/310</span>\n            </div>\n\n            {formation.slots.map((slot) => (''',
    '''            <div className="pointer-events-none absolute right-2 top-2 z-40 rounded-lg bg-black/60 px-2 py-1 text-right backdrop-blur sm:right-3 sm:top-3 sm:rounded-xl sm:px-3 sm:py-2">\n              <span className="text-[9px] text-gray-300 sm:text-xs">급여 </span>\n              <span className="text-[12px] font-black text-white sm:text-base">{totalSalary}</span>\n              <span className="text-[9px] text-gray-300 sm:text-xs">/310</span>\n            </div>\n\n            <button\n              type="button"\n              data-capture-hide="true"\n              onClick={(event) => {\n                event.stopPropagation();\n                void saveSquadImage();\n              }}\n              disabled={savingImage}\n              className="absolute bottom-2 left-2 z-[55] rounded-lg border border-white/15 bg-black/65 px-2.5 py-1.5 text-[9px] font-black text-white shadow-lg backdrop-blur transition hover:bg-black/80 disabled:opacity-50 sm:bottom-3 sm:left-3 sm:px-3 sm:py-2 sm:text-xs"\n            >\n              {savingImage ? "저장 중..." : "이미지 저장"}\n            </button>\n\n            {teamColorState.teamColors.length > 0 && (\n              <div className="absolute bottom-2 right-2 z-[55] flex max-w-[55%] flex-row-reverse gap-1.5 sm:bottom-3 sm:right-3 sm:gap-2">\n                {teamColorState.teamColors.map((color) => (\n                  <details key={color.name} className="group relative">\n                    <summary\n                      className="relative flex h-8 w-8 cursor-pointer list-none items-center justify-center overflow-visible rounded-full border border-white/20 bg-black/70 shadow-lg backdrop-blur transition hover:scale-105 sm:h-10 sm:w-10 [&::-webkit-details-marker]:hidden"\n                      title={`${color.name} · ${color.count}명 · ${color.level}단계`}\n                    >\n                      <span className="absolute inset-1 flex items-center justify-center rounded-full bg-white/10 text-[8px] font-black text-white sm:text-[10px]">\n                        {initials(color.name)}\n                      </span>\n                      {color.emblemUrl && (\n                        <img\n                          src={color.emblemUrl}\n                          alt={color.name}\n                          className="relative z-10 h-6 w-6 object-contain drop-shadow sm:h-8 sm:w-8"\n                        />\n                      )}\n                    </summary>\n                    <div\n                      data-capture-tooltip="true"\n                      className="pointer-events-none invisible absolute bottom-full right-0 z-[70] mb-2 w-52 translate-y-1 rounded-xl border border-white/15 bg-[#111318]/95 p-3 text-left opacity-0 shadow-2xl backdrop-blur transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-open:visible group-open:translate-y-0 group-open:opacity-100 sm:w-60"\n                    >\n                      <p className="text-xs font-black text-white">{color.name}</p>\n                      <p className="mt-1 text-[10px] font-bold text-lime-300">\n                        {color.count}명 · {color.level}단계 · 적응도 {teamColorState.adaptation}\n                      </p>\n                      <p className="mt-1.5 text-[10px] leading-4 text-gray-300">\n                        {color.effect || `팀컬러 ${color.level}단계 적용`}\n                      </p>\n                    </div>\n                  </details>\n                ))}\n              </div>\n            )}\n\n            {teamColorState.loading && teamColorState.teamColors.length === 0 && (\n              <div data-capture-hide="true" className="pointer-events-none absolute bottom-2 right-2 z-[55] rounded-lg bg-black/55 px-2 py-1 text-[8px] font-bold text-gray-300 backdrop-blur sm:bottom-3 sm:right-3 sm:text-[10px]">\n                팀컬러 계산 중\n              </div>\n            )}\n\n            {formation.slots.map((slot) => (''',
    "maker pitch controls",
)

text = replace_once(
    text,
    '''                  dropTarget={slot.slotId === dropTargetSlotId}\n                  onClick={() => handleSlotClick(slot.slotId)}''',
    '''                  dropTarget={slot.slotId === dropTargetSlotId}\n                  calculatedOvr={teamColorState.ovrBySlot[slot.slotId] ?? null}\n                  onClick={() => handleSlotClick(slot.slotId)}''',
    "maker slot calculated ovr",
)

text = replace_once(
    text,
    '''  dropTarget,\n  onClick,''',
    '''  dropTarget,\n  calculatedOvr,\n  onClick,''',
    "slot destructure",
)
text = replace_once(
    text,
    '''  dropTarget: boolean;\n  onClick: () => void;''',
    '''  dropTarget: boolean;\n  calculatedOvr?: number | null;\n  onClick: () => void;''',
    "slot prop type",
)
text = replace_once(
    text,
    '''          grade={player.grade}\n          newTraits={player.newTraits ?? []}''',
    '''          grade={player.grade}\n          calculatedOvr={calculatedOvr}\n          newTraits={player.newTraits ?? []}''',
    "slot pass calculated ovr",
)

maker_path.write_text(text, encoding="utf-8")
