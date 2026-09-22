export default function SiteHeaderBrand() {
  return (
    <span className="flex items-center gap-2.5" aria-label="FC Help">
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-visible">
        <span className="absolute inset-[2px] rotate-45 rounded-[10px] border-[4px] border-white border-r-[#00ef62]" />
        <span className="relative z-10 text-[20px] leading-none">⚽</span>
        <span className="absolute -right-1 top-[9px] h-[4px] w-2 rotate-[-35deg] rounded-full bg-[#00ef62]" />
        <span className="absolute -right-2 top-[18px] h-[4px] w-2 rounded-full bg-[#00ef62]" />
        <span className="absolute -right-1 top-[27px] h-[4px] w-2 rotate-[35deg] rounded-full bg-[#00ef62]" />
      </span>
      <span className="flex items-baseline text-[27px] font-black italic tracking-[-0.08em] text-white sm:text-[30px]">
        <span>FC&nbsp;</span><span className="text-[#00ef62]">H</span><span>elp</span>
      </span>
    </span>
  );
}
