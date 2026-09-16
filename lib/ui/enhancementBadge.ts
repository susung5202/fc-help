export function getEnhancementBadgeTone(grade: number) {
  if (grade >= 11) {
    return "border-cyan-200/90 bg-[#16748f] text-cyan-50 shadow-[0_0_12px_rgba(34,211,238,0.22)]";
  }

  if (grade >= 8) {
    return "border-yellow-300/90 bg-[#a97812] text-yellow-50 shadow-[0_0_10px_rgba(250,204,21,0.16)]";
  }

  if (grade >= 5) {
    return "border-slate-200/90 bg-[#5f6875] text-white shadow-[0_0_8px_rgba(226,232,240,0.10)]";
  }

  if (grade >= 2) {
    return "border-orange-700/90 bg-[#6b351c] text-orange-50 shadow-[0_0_8px_rgba(194,65,12,0.12)]";
  }

  return "border-zinc-500/90 bg-[#3f3f46] text-zinc-100";
}
