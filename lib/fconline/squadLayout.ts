export type PitchSlot = { slotId: string; label: string; x: number; y: number };
export type PositionZone = { id: string; label: string; left: number; top: number; width: number; height: number };

// Invisible pitch regions. Only the hovered position is shown on the dragged card.
const centralRows = [
  { top: 4, height: 12, labels: ["LS", "ST", "RS"] },
  { top: 16, height: 12, labels: ["LF", "CF", "RF"] },
  { top: 28, height: 10, labels: ["LAM", "CAM", "RAM"] },
  { top: 38, height: 10, labels: ["LCM", "CM", "RCM"] },
  { top: 48, height: 12, labels: ["LDM", "CDM", "RDM"] },
  { top: 60, height: 12, labels: ["LCB", "CB", "RCB"] },
];
const wideRows = [
  { top: 4, height: 24, labels: ["LW", "RW"] },
  { top: 28, height: 18, labels: ["LM", "RM"] },
  { top: 46, height: 14, labels: ["LWB", "RWB"] },
  { top: 60, height: 18, labels: ["LB", "RB"] },
];
export const POSITION_ZONES: PositionZone[] = [
  ...centralRows.flatMap(({ top, height, labels }) => labels.map((label, index) => ({
    id: `zone-${label}`, label, top, height, left: 23 + index * 18, width: 18,
  }))),
  ...wideRows.flatMap(({ top, height, labels }) => labels.map((label, index) => ({
    id: `zone-${label}`, label, top, height, left: index === 0 ? 5 : 77, width: 18,
  }))),
  { id: "zone-SW", label: "SW", top: 72, height: 8, left: 23, width: 54 },
];

export function findPositionZone(x: number, y: number) {
  return POSITION_ZONES.find((zone) => x >= zone.left && x < zone.left + zone.width && y >= zone.top && y < zone.top + zone.height) ?? null;
}

function lineCounts(slots: PitchSlot[]) {
  const groups = [["LB", "LCB", "CB", "RCB", "RB", "LWB", "RWB", "SW"], ["CDM", "LDM", "RDM"], ["LM", "CM", "RM", "LCM", "RCM"], ["LAM", "CAM", "RAM"], ["ST", "CF", "LW", "RW", "LS", "RS", "LF", "RF"]];
  return groups.map((labels) => slots.filter((slot) => labels.includes(slot.label)).length);
}

export function formationName(slots: PitchSlot[], presets: Record<string, { slots: PitchSlot[] }>) {
  const counts = lineCounts(slots);
  // Keep familiar preset names, including the conventional 3-5-2 midfield.
  const matching = Object.entries(presets).find(([, preset]) => lineCounts(preset.slots).every((count, index) => count === counts[index]));
  return matching?.[0] ?? counts.filter(Boolean).join("-");
}

export function restorePositions(value: unknown, base: PitchSlot[]): Record<string, PitchSlot> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, PitchSlot> = {};
  for (const slot of base) {
    const candidate = (value as Record<string, PitchSlot>)[slot.slotId];
    if (!candidate || slot.label === "GK" || !Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) continue;
    // Preserve positions saved before the regions were subdivided.
    const supported = POSITION_ZONES.some((zone) => zone.label === candidate.label);
    if (supported && candidate.x >= 5 && candidate.x < 95 && candidate.y >= 4 && candidate.y < 80) {
      result[slot.slotId] = { slotId: slot.slotId, label: candidate.label, x: candidate.x, y: candidate.y };
    }
  }
  return result;
}
