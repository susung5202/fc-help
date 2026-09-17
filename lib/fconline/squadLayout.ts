export type PitchSlot = { slotId: string; label: string; x: number; y: number };
export type PositionZone = { id: string; label: string; left: number; top: number; width: number; height: number };

// These same rectangles are used for both rendering and hit testing.
export const POSITION_ZONES: PositionZone[] = [
  { top: 4, height: 18, labels: ["LW", "ST", "RW"] },
  { top: 22, height: 12, labels: ["LAM", "CAM", "RAM"] },
  { top: 34, height: 11, labels: ["LM", "CM", "RM"] },
  { top: 45, height: 14, labels: ["LWB", "CDM", "RWB"] },
  { top: 59, height: 18, labels: ["LB", "CB", "RB"] },
].flatMap(({ top, height, labels }) => labels.map((label, index) => ({
  id: `zone-${label}`, label, top, height,
  left: [5, 27, 73][index], width: [22, 46, 22][index],
})));

export function findPositionZone(x: number, y: number) {
  return POSITION_ZONES.find((zone) => x >= zone.left && x < zone.left + zone.width && y >= zone.top && y < zone.top + zone.height) ?? null;
}

function lineCounts(slots: PitchSlot[]) {
  const groups = [["LB", "CB", "RB", "LWB", "RWB", "SW"], ["CDM", "LDM", "RDM"], ["LM", "CM", "RM", "LCM", "RCM"], ["LAM", "CAM", "RAM"], ["ST", "CF", "LW", "RW", "LS", "RS", "LF", "RF"]];
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
    const zone = findPositionZone(candidate.x, candidate.y);
    if (zone?.label === candidate.label) result[slot.slotId] = { slotId: slot.slotId, label: zone.label, x: candidate.x, y: candidate.y };
  }
  return result;
}
