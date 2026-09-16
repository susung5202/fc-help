export function getEnhancementBadgeTone(grade: number) {
  if (grade >= 11) {
    return "border-[#5274c0] border-t-[#bdc5e5] border-l-[#607dc4] border-r-[#5274c0] bg-[url('https://ssl.nexon.com/s2/game/fc/online/obt/datacenter/bg_plt.png')] bg-[length:100%_100%] bg-no-repeat text-[#2d2b43]";
  }

  if (grade >= 8) {
    return "border-[#cda000] border-t-[#e9d36c] border-l-[#e9d36c] border-r-[#cda000] bg-[linear-gradient(140deg,#f9dd62_0%,#f9dd62_0%,#dca908_100%)] text-[#695100]";
  }

  if (grade >= 5) {
    return "border-[#a5a8ae] border-t-[#d8dadc] border-l-[#d8dadc] border-r-[#a9aaae] bg-[linear-gradient(140deg,rgb(216,217,220)_0%,rgb(216,217,220)_0%,rgb(184,189,202)_100%)] text-[#4e545e]";
  }

  if (grade >= 2) {
    return "border-[#864229] border-t-[#e4b7a2] border-l-[#e4b7a2] border-r-[#864229] bg-[linear-gradient(140deg,#de946b_0%,#de946b_0%,#ad5f42_100%)] text-[#7e3f27]";
  }

  return "border-[#393a3c] border-t-[#62676d] border-l-[#62676d] border-r-[#393a3c] bg-[linear-gradient(140deg,#51545a_0%,#51545a_0%,#42464d_100%)] text-[#c5c8c9]";
}
