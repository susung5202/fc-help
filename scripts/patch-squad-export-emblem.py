from pathlib import Path
import re

maker_path = Path('components/SquadMaker.tsx')
team_path = Path('app/api/squad/team-color/route.ts')
maker = maker_path.read_text(encoding='utf-8')
team = team_path.read_text(encoding='utf-8')

# Use html2canvas-pro for Tailwind 4 modern CSS color support.
maker = maker.replace('await import("html2canvas")', 'await import("html2canvas-pro")')

# Keep a generated image in memory so mobile/iOS can invoke Web Share from a fresh user tap.
state_needle = '  const [savingImage, setSavingImage] = useState(false);\n'
state_replacement = '''  const [savingImage, setSavingImage] = useState(false);\n  const [imagePreview, setImagePreview] = useState<{ url: string; file: File } | null>(null);\n'''
if state_needle not in maker:
    raise SystemExit('savingImage state marker not found')
maker = maker.replace(state_needle, state_replacement, 1)

# Replace the share/download tail of image generation. On browsers with file sharing,
# show a preview first; the second tap calls navigator.share with fresh user activation.
share_pattern = re.compile(r'''      const filename = `fc-help-squad-\$\{formationKey\}-\$\{new Date\(\)\.toISOString\(\)\.slice\(0, 10\)\}\.png`;\n      const file = new File\(\[blob\], filename, \{ type: "image/png" \}\);\n      const shareNavigator = navigator as Navigator & \{\n        canShare\?: \(data\?: ShareData\) => boolean;\n      \};\n\n      if \(navigator\.share && shareNavigator\.canShare\?\.\(\{ files: \[file\] \}\)\) \{[\s\S]*?      \}\n    \} catch \(captureError\) \{''')
match = share_pattern.search(maker)
if not match:
    raise SystemExit('image share block not found')
replacement = '''      const filename = `fc-help-squad-${formationKey}-${new Date().toISOString().slice(0, 10)}.png`;
      const file = new File([blob], filename, { type: "image/png" });
      const shareNavigator = navigator as Navigator & {
        canShare?: (data?: ShareData) => boolean;
      };
      const objectUrl = URL.createObjectURL(blob);

      if (navigator.share && shareNavigator.canShare?.({ files: [file] })) {
        setImagePreview((current) => {
          if (current) URL.revokeObjectURL(current.url);
          return { url: objectUrl, file };
        });
      } else {
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = filename;
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      }
    } catch (captureError) {'''
maker = maker[:match.start()] + replacement + maker[match.end():]

# Add a direct-user-gesture save/share handler and preview closer.
function_marker = '''  const panel = selectedSlot ? ('''
share_functions = '''  async function savePreviewImage() {
    if (!imagePreview) return;
    const shareNavigator = navigator as Navigator & {
      canShare?: (data?: ShareData) => boolean;
    };

    if (navigator.share && shareNavigator.canShare?.({ files: [imagePreview.file] })) {
      try {
        await navigator.share({ files: [imagePreview.file], title: "FC Help 스쿼드" });
        return;
      } catch (shareError) {
        if (shareError instanceof DOMException && shareError.name === "AbortError") return;
        console.warn("Native image share failed; falling back to download", shareError);
      }
    }

    const link = document.createElement("a");
    link.href = imagePreview.url;
    link.download = imagePreview.file.name;
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function closeImagePreview() {
    setImagePreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
  }

'''
if function_marker not in maker:
    raise SystemExit('panel marker not found')
maker = maker.replace(function_marker, share_functions + function_marker, 1)

# Add mobile-safe preview dialog before the player picker overlay.
overlay_marker = '''      {selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 xl:hidden">'''
preview_ui = '''      {imagePreview && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4" onClick={closeImagePreview}>
          <div
            className="w-full max-w-[620px] rounded-2xl border border-white/15 bg-[#15181d] p-3 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <img src={imagePreview.url} alt="저장할 스쿼드 이미지 미리보기" className="max-h-[72vh] w-full rounded-xl object-contain" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void savePreviewImage()}
                className="rounded-xl bg-lime-300 px-4 py-3 text-sm font-black text-black"
              >
                사진 저장
              </button>
              <button
                type="button"
                onClick={closeImagePreview}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-white"
              >
                닫기
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-gray-500">iPhone에서는 사진 저장을 누른 뒤 공유 시트에서 ‘이미지 저장’을 선택하세요.</p>
          </div>
        </div>
      )}

'''
if overlay_marker not in maker:
    raise SystemExit('selectedSlot overlay marker not found')
maker = maker.replace(overlay_marker, preview_ui + overlay_marker, 1)

# Enhancement team colors: parse the official enhancement selector as well as affiliation/relationship.
base_type_needle = '''  baseOvr: number | null;
  affiliationOptions: TeamColorOption[];
  relationshipOptions: TeamColorOption[];
};'''
base_type_replacement = '''  baseOvr: number | null;
  enhancementOptions: TeamColorOption[];
  affiliationOptions: TeamColorOption[];
  relationshipOptions: TeamColorOption[];
};'''
if base_type_needle not in team:
    raise SystemExit('BasePlayerData marker not found')
team = team.replace(base_type_needle, base_type_replacement, 1)

options_needle = '''          baseOvr: parsePositionOvr(html, player.position),
          affiliationOptions: parseOptionsBetween(html, "소속 팀컬러", "관계 팀컬러"),
          relationshipOptions: parseOptionsBetween(html, "관계 팀컬러", "클래스 비교"),'''
options_replacement = '''          baseOvr: parsePositionOvr(html, player.position),
          enhancementOptions: parseOptionsBetween(html, "강화 팀컬러", "소속 팀컬러"),
          affiliationOptions: parseOptionsBetween(html, "소속 팀컬러", "관계 팀컬러"),
          relationshipOptions: parseOptionsBetween(html, "관계 팀컬러", "클래스 비교"),'''
if options_needle not in team:
    raise SystemExit('team color option parsing marker not found')
team = team.replace(options_needle, options_replacement, 1)

enhancement_needle = '''    const enhancement = selectEnhancement(players);

    const appliedBySlot: Record<'''
enhancement_replacement = '''    const enhancement = selectEnhancement(players);
    const enhancementOption = enhancement
      ? basePlayers
          .flatMap((item) => item.enhancementOptions)
          .find((option) => option.name === enhancement.name) ?? {
          name: enhancement.name,
          id: null,
          emblemUrl: null,
        }
      : null;
    const enhancementInfo = enhancementOption ? await fetchTeamInfo(enhancementOption) : null;

    const appliedBySlot: Record<'''
if enhancement_needle not in team:
    raise SystemExit('enhancement selection marker not found')
team = team.replace(enhancement_needle, enhancement_replacement, 1)

team = team.replace('''          id: null,
          emblemUrl: null,
          count: enhancement.count,''', '''          id: enhancementInfo?.id ?? enhancementOption?.id ?? null,
          emblemUrl: enhancementInfo?.emblemUrl ?? enhancementOption?.emblemUrl ?? null,
          count: enhancement.count,''', 1)

maker_path.write_text(maker, encoding='utf-8')
team_path.write_text(team, encoding='utf-8')
