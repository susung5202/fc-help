export function getEnhancementBadgeTone(grade: number) {
  if (grade >= 11) {
    return "border-[#9fd8ff] bg-[linear-gradient(135deg,#a9dfff_0%,#e6d5ff_28%,#fff4fa_50%,#b7d6ff_72%,#d8c5ff_100%)] text-[#202334] shadow-[inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-2px_0_rgba(67,116,184,0.45),0_1px_2px_rgba(0,0,0,0.35)]";
  }

  if (grade >= 8) {
    return "border-[#ffe66a] bg-[linear-gradient(180deg,#ffe85a_0%,#f7cc22_48%,#dba800_100%)] text-[#634d00] shadow-[inset_0_1px_0_rgba(255,255,255,0.72),inset_0_-2px_0_rgba(151,105,0,0.45),0_1px_2px_rgba(0,0,0,0.35)]";
  }

  if (grade >= 5) {
    return "border-[#eef1f5] bg-[linear-gradient(180deg,#e6e9ee_0%,#c5cad2_48%,#9da4ae_100%)] text-[#4a515c] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-2px_0_rgba(89,98,111,0.38),0_1px_2px_rgba(0,0,0,0.35)]";
  }

  if (grade >= 2) {
    return "border-[#e4a17d] bg-[linear-gradient(180deg,#d99470_0%,#c27655_48%,#9b563c_100%)] text-[#60331f] shadow-[inset_0_1px_0_rgba(255,221,203,0.72),inset_0_-2px_0_rgba(91,45,29,0.42),0_1px_2px_rgba(0,0,0,0.35)]";
  }

  return "border-[#747983] bg-[linear-gradient(180deg,#60636c_0%,#4d5059_48%,#393c44_100%)] text-[#d8dbe0] shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-2px_0_rgba(0,0,0,0.32),0_1px_2px_rgba(0,0,0,0.4)]";
}
