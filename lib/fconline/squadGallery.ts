export type GalleryPlayer = {
  id: number;
  name: string;
  seasonName?: string | null;
  seasonImg?: string | null;
  ovr?: number | null;
  position?: string | null;
  grade: number;
  artworkSpid?: number;
};

export type GallerySlot = {
  slotId: string;
  label: string;
  x: number;
  y: number;
};

export type GallerySquadData = {
  formationKey?: string;
  customPositions?: Record<string, GallerySlot>;
  players?: Record<string, GalleryPlayer>;
};

const FORMATIONS: Record<string, GallerySlot[]> = {
  "4-2-3-1": [
    { slotId: "p0", label: "ST", x: 50, y: 10 },
    { slotId: "p1", label: "LAM", x: 24, y: 27 },
    { slotId: "p2", label: "CAM", x: 50, y: 25 },
    { slotId: "p3", label: "RAM", x: 76, y: 27 },
    { slotId: "p4", label: "CDM", x: 38, y: 45 },
    { slotId: "p5", label: "CDM", x: 62, y: 45 },
    { slotId: "p6", label: "LB", x: 15, y: 67 },
    { slotId: "p7", label: "CB", x: 38, y: 64 },
    { slotId: "p8", label: "CB", x: 62, y: 64 },
    { slotId: "p9", label: "RB", x: 85, y: 67 },
    { slotId: "p10", label: "GK", x: 50, y: 86 },
  ],
  "4-3-3": [
    { slotId: "p0", label: "LW", x: 20, y: 15 },
    { slotId: "p1", label: "ST", x: 50, y: 9 },
    { slotId: "p2", label: "RW", x: 80, y: 15 },
    { slotId: "p3", label: "CM", x: 28, y: 40 },
    { slotId: "p4", label: "CM", x: 50, y: 35 },
    { slotId: "p5", label: "CM", x: 72, y: 40 },
    { slotId: "p6", label: "LB", x: 15, y: 67 },
    { slotId: "p7", label: "CB", x: 38, y: 64 },
    { slotId: "p8", label: "CB", x: 62, y: 64 },
    { slotId: "p9", label: "RB", x: 85, y: 67 },
    { slotId: "p10", label: "GK", x: 50, y: 86 },
  ],
  "4-1-2-3": [
    { slotId: "p0", label: "LW", x: 19, y: 15 },
    { slotId: "p1", label: "ST", x: 50, y: 9 },
    { slotId: "p2", label: "RW", x: 81, y: 15 },
    { slotId: "p3", label: "CM", x: 32, y: 38 },
    { slotId: "p4", label: "CM", x: 68, y: 38 },
    { slotId: "p5", label: "CDM", x: 50, y: 53 },
    { slotId: "p6", label: "LB", x: 15, y: 68 },
    { slotId: "p7", label: "CB", x: 38, y: 65 },
    { slotId: "p8", label: "CB", x: 62, y: 65 },
    { slotId: "p9", label: "RB", x: 85, y: 68 },
    { slotId: "p10", label: "GK", x: 50, y: 86 },
  ],
  "4-2-2-2": [
    { slotId: "p0", label: "ST", x: 37, y: 10 },
    { slotId: "p1", label: "ST", x: 63, y: 10 },
    { slotId: "p2", label: "LAM", x: 24, y: 30 },
    { slotId: "p3", label: "RAM", x: 76, y: 30 },
    { slotId: "p4", label: "CDM", x: 38, y: 47 },
    { slotId: "p5", label: "CDM", x: 62, y: 47 },
    { slotId: "p6", label: "LB", x: 15, y: 68 },
    { slotId: "p7", label: "CB", x: 38, y: 65 },
    { slotId: "p8", label: "CB", x: 62, y: 65 },
    { slotId: "p9", label: "RB", x: 85, y: 68 },
    { slotId: "p10", label: "GK", x: 50, y: 86 },
  ],
  "4-4-2": [
    { slotId: "p0", label: "ST", x: 37, y: 10 },
    { slotId: "p1", label: "ST", x: 63, y: 10 },
    { slotId: "p2", label: "LM", x: 18, y: 38 },
    { slotId: "p3", label: "CM", x: 40, y: 40 },
    { slotId: "p4", label: "CM", x: 60, y: 40 },
    { slotId: "p5", label: "RM", x: 82, y: 38 },
    { slotId: "p6", label: "LB", x: 15, y: 68 },
    { slotId: "p7", label: "CB", x: 38, y: 65 },
    { slotId: "p8", label: "CB", x: 62, y: 65 },
    { slotId: "p9", label: "RB", x: 85, y: 68 },
    { slotId: "p10", label: "GK", x: 50, y: 86 },
  ],
  "3-5-2": [
    { slotId: "p0", label: "ST", x: 37, y: 10 },
    { slotId: "p1", label: "ST", x: 63, y: 10 },
    { slotId: "p2", label: "LM", x: 15, y: 37 },
    { slotId: "p3", label: "CAM", x: 50, y: 30 },
    { slotId: "p4", label: "RM", x: 85, y: 37 },
    { slotId: "p5", label: "CDM", x: 38, y: 50 },
    { slotId: "p6", label: "CDM", x: 62, y: 50 },
    { slotId: "p7", label: "CB", x: 25, y: 68 },
    { slotId: "p8", label: "CB", x: 50, y: 64 },
    { slotId: "p9", label: "CB", x: 75, y: 68 },
    { slotId: "p10", label: "GK", x: 50, y: 86 },
  ],
};

export function getGallerySlots(data: GallerySquadData) {
  const base = FORMATIONS[data.formationKey ?? "4-2-3-1"] ?? FORMATIONS["4-2-3-1"];
  const custom = data.customPositions ?? {};
  return base.map((slot) => custom[slot.slotId] ?? slot);
}

export function formatGalleryValue(value: string | number | null | undefined) {
  const digits = String(value ?? "0").replace(/\D/g, "").replace(/^0+(?=\d)/, "") || "0";
  if (digits === "0") return "0 BP";
  if (digits.length <= 8) return `${Number(digits).toLocaleString("ko-KR")} BP`;
  const labels = ["", "만", "억", "조", "경", "해"];
  const groups = digits.padStart(Math.ceil(digits.length / 4) * 4, "0").match(/.{4}/g) ?? [];
  const parts: string[] = [];
  groups.forEach((group, index) => {
    const amount = Number(group);
    if (!amount) return;
    const unit = groups.length - index - 1;
    parts.push(`${amount.toLocaleString("ko-KR")}${labels[unit] ?? ""}`);
  });
  return `${parts.slice(0, 2).join(" ")} BP`;
}
