export function getEnhancementBadgeTone(grade: number) {
  if (grade >= 11) {
    return "border-cyan-300/70 bg-cyan-400/20 text-cyan-100";
  }
  if (grade >= 8) {
    return "border-yellow-300/70 bg-yellow-400/20 text-yellow-100";
  }
  if (grade >= 5) {
    return "border-slate-200/70 bg-slate-200/20 text-slate-100";
  }
  if (grade >= 2) {
    return "border-amber-700/80 bg-amber-900/35 text-amber-200";
  }
  return "border-zinc-400/40 bg-zinc-500/20 text-zinc-200";
}
