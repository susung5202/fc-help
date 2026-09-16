from pathlib import Path
import re

maker_path = Path('components/SquadMaker.tsx')
card_path = Path('components/SquadPlayerCard.tsx')
maker = maker_path.read_text(encoding='utf-8')
card = card_path.read_text(encoding='utf-8')

old_types = '''type TeamColorSummary = {
  name: string;
  count: number;
  level: number;
  maxLevel: number;
  maxRequired: number;
  effect: string;
  emblemUrl: string | null;
};

type TeamColorState = {
  adaptation: number;
  teamColors: TeamColorSummary[];
  ovrBySlot: Record<string, number | null>;
  appliedBySlot: Record<string, string | null>;
  loading: boolean;
};'''
new_types = '''type TeamColorCategory = "affiliation" | "enhancement" | "trait";

type TeamColorSummary = {
  name: string;
  category: TeamColorCategory;
  count: number;
  level: number;
  maxLevel: number;
  maxRequired: number;
  effect: string;
  emblemUrl: string | null;
};

type TeamColorState = {
  adaptation: number;
  teamColors: TeamColorSummary[];
  ovrBySlot: Record<string, number | null>;
  appliedBySlot: Record<
    string,
    { affiliation: string | null; enhancement: string | null; trait: string | null }
  >;
  loading: boolean;
};'''
if old_types not in maker:
    raise SystemExit('team color types block not found')
maker = maker.replace(old_types, new_types, 1)

# Remove obsolete SVG capture helpers.
start = maker.find('function inlineComputedStyles(')
end = maker.find('function withTraitDefaults(', start)
if start < 0 or end < 0:
    raise SystemExit('capture helpers block not found')
maker = maker[:start] + maker[end:]

# Add enhancement OVR fallback bonuses near STORAGE_KEY.
needle = 'const STORAGE_KEY = "fc-help-squad-v1";\nconst SUMMARY_CARD_CACHE = new Map<string, SquadCardDetails>();'
replacement = '''const STORAGE_KEY = "fc-help-squad-v1";
const SUMMARY_CARD_CACHE = new Map<string, SquadCardDetails>();
const SQUAD_ENHANCEMENT_OVR_BONUS: Record<number, number> = {
  1: 0, 2: 1, 3: 2, 4: 4, 5: 6, 6: 8, 7: 11,
  8: 15, 9: 17, 10: 19, 11: 21, 12: 24, 13: 27,
};'''
if needle not in maker:
    raise SystemExit('storage marker not found')
maker = maker.replace(needle, replacement, 1)

# Fallback average now also reflects enhancement + adaptation 5.
old_avg = '''        const officialSlotOvr = cardDetails[slotId]?.positionOvr;
        if (officialSlotOvr !== null && officialSlotOvr !== undefined) {
          return officialSlotOvr;
        }

        const slot = formation.slots.find((item) => item.slotId === slotId);
        return slot?.label === player.position ? player.ovr : null;'''
new_avg = '''        const officialSlotOvr = cardDetails[slotId]?.positionOvr;
        if (officialSlotOvr !== null && officialSlotOvr !== undefined) {
          return officialSlotOvr + (SQUAD_ENHANCEMENT_OVR_BONUS[player.grade] ?? 0) + 4;
        }

        const slot = formation.slots.find((item) => item.slotId === slotId);
        return slot?.label === player.position && player.ovr !== null
          ? player.ovr + (SQUAD_ENHANCEMENT_OVR_BONUS[player.grade] ?? 0) + 4
          : null;'''
if old_avg not in maker:
    raise SystemExit('average fallback block not found')
maker = maker.replace(old_avg, new_avg, 1)

# Replace image saving with html2canvas + iOS share sheet.
pattern = re.compile(r'  async function saveSquadImage\(\) \{[\s\S]*?\n  \}\n\n  const panel =', re.M)
match = pattern.search(maker)
if not match:
    raise SystemExit('saveSquadImage block not found')
new_save = '''  async function saveSquadImage() {
    const pitch = pitchRef.current;
    if (!pitch || savingImage) return;
    setSavingImage(true);
    let captureRoot: HTMLDivElement | null = null;

    try {
      const rect = pitch.getBoundingClientRect();
      captureRoot = pitch.cloneNode(true) as HTMLDivElement;
      captureRoot.querySelectorAll("[data-capture-hide='true']").forEach((element) => element.remove());
      captureRoot.querySelectorAll("[data-capture-tooltip='true']").forEach((element) => element.remove());
      captureRoot.style.position = "fixed";
      captureRoot.style.left = "-10000px";
      captureRoot.style.top = "0";
      captureRoot.style.width = `${rect.width}px`;
      captureRoot.style.height = `${rect.height}px`;
      captureRoot.style.maxWidth = "none";
      captureRoot.style.margin = "0";
      document.body.appendChild(captureRoot);

      const images = Array.from(captureRoot.querySelectorAll("img"));
      await Promise.all(
        images.map(async (image) => {
          const src = image.src;
          if (!src || src.startsWith("data:") || src.startsWith(window.location.origin)) return;
          image.src = `/api/squad/image-proxy?url=${encodeURIComponent(src)}`;
          try {
            await image.decode();
          } catch {
            await new Promise<void>((resolve) => {
              image.onload = () => resolve();
              image.onerror = () => resolve();
            });
          }
        })
      );

      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(captureRoot, {
        backgroundColor: null,
        scale: Math.min(3, Math.max(2, window.devicePixelRatio || 2)),
        useCORS: true,
        allowTaint: false,
        logging: false,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      });

      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (result) => (result ? resolve(result) : reject(new Error("png export failed"))),
          "image/png",
          1
        )
      );
      const filename = `fc-help-squad-${formationKey}-${new Date().toISOString().slice(0, 10)}.png`;
      const file = new File([blob], filename, { type: "image/png" });
      const shareNavigator = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };

      if (navigator.share && shareNavigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "FC Help 스쿼드" });
        } catch (shareError) {
          if (shareError instanceof DOMException && shareError.name === "AbortError") return;
          throw shareError;
        }
      } else {
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);
      }
    } catch (captureError) {
      console.error("Squad image capture failed", captureError);
      window.alert("스쿼드 이미지 저장에 실패했습니다. 다시 시도해주세요.");
    } finally {
      captureRoot?.remove();
      setSavingImage(false);
    }
  }

  const panel ='''
maker = maker[:match.start()] + new_save + maker[match.end():]

# Replace team-color display with three fixed category boxes.
start_marker = '            {teamColorState.teamColors.length > 0 && ('
end_marker = '            {formation.slots.map((slot) => ('
start = maker.find(start_marker)
end = maker.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('team color UI block not found')
new_ui = '''            <div className="absolute bottom-2 right-2 z-[55] flex gap-1.5 sm:bottom-3 sm:right-3 sm:gap-2">
              {([
                ["affiliation", "소속"],
                ["enhancement", "강화"],
                ["trait", "특성"],
              ] as const).map(([category, label]) => {
                const colors = teamColorState.teamColors.filter((color) => color.category === category);
                if (colors.length === 0) {
                  return (
                    <div key={category} className="flex flex-col items-center gap-0.5">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-dashed border-white/35 bg-black/25 text-[9px] font-black text-white/35 sm:h-10 sm:w-10"
                        title={`${label} 팀컬러 없음`}
                      >
                        -
                      </div>
                      <span className="text-[7px] font-bold text-white/45 sm:text-[8px]">{label}</span>
                    </div>
                  );
                }

                const primary = colors[0];
                return (
                  <details key={category} className="group relative flex flex-col items-center">
                    <summary
                      className="relative flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-white/20 bg-black/70 shadow-lg backdrop-blur transition hover:scale-105 sm:h-10 sm:w-10 [&::-webkit-details-marker]:hidden"
                      title={`${label} 팀컬러 · ${colors.map((color) => color.name).join(", ")}`}
                    >
                      {primary.emblemUrl ? (
                        <img
                          src={primary.emblemUrl}
                          alt={primary.name}
                          className="h-6 w-6 object-contain drop-shadow sm:h-8 sm:w-8"
                        />
                      ) : (
                        <span className="text-[9px] font-black text-white sm:text-[11px]">{initials(primary.name)}</span>
                      )}
                      {colors.length > 1 && (
                        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-lime-300 px-1 text-[7px] font-black text-black">
                          {colors.length}
                        </span>
                      )}
                    </summary>
                    <span className="mt-0.5 block text-center text-[7px] font-bold text-white/70 sm:text-[8px]">{label}</span>
                    <div
                      data-capture-tooltip="true"
                      className="pointer-events-none invisible absolute bottom-full right-0 z-[70] mb-2 w-56 translate-y-1 rounded-xl border border-white/15 bg-[#111318]/95 p-3 text-left opacity-0 shadow-2xl backdrop-blur transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-open:visible group-open:translate-y-0 group-open:opacity-100 sm:w-64"
                    >
                      <p className="text-[10px] font-black text-lime-300">{label} 팀컬러</p>
                      <div className="mt-2 space-y-2">
                        {colors.map((color) => (
                          <div key={`${category}-${color.name}`} className="border-t border-white/10 pt-2 first:border-t-0 first:pt-0">
                            <p className="text-xs font-black text-white">{color.name}</p>
                            <p className="mt-0.5 text-[9px] font-bold text-gray-400">
                              {color.count}명 · {color.level}단계 · 적응도 {teamColorState.adaptation}
                            </p>
                            <p className="mt-1 text-[9px] leading-4 text-gray-300">
                              {color.effect || `${label} 팀컬러 적용`}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>

            {teamColorState.loading && (
              <div data-capture-hide="true" className="pointer-events-none absolute bottom-14 right-2 z-[55] rounded-md bg-black/55 px-2 py-1 text-[8px] font-bold text-gray-300 backdrop-blur sm:bottom-16 sm:right-3 sm:text-[9px]">
                팀컬러 계산 중
              </div>
            )}

'''
maker = maker[:start] + new_ui + maker[end:]

# Fallback card OVR always includes adaptation 5.
old_card = '''  const enhancedOvr =
    calculatedOvr !== null && calculatedOvr !== undefined
      ? calculatedOvr
      : positionOvr === null
        ? null
        : positionOvr + (ENHANCEMENT_OVR_BONUS[grade] ?? 0);'''
new_card = '''  const enhancedOvr =
    calculatedOvr !== null && calculatedOvr !== undefined
      ? calculatedOvr
      : positionOvr === null
        ? null
        : positionOvr + (ENHANCEMENT_OVR_BONUS[grade] ?? 0) + 4;'''
if old_card not in card:
    raise SystemExit('card OVR block not found')
card = card.replace(old_card, new_card, 1)

maker_path.write_text(maker, encoding='utf-8')
card_path.write_text(card, encoding='utf-8')
