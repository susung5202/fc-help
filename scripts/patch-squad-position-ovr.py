from pathlib import Path

path = Path("components/SquadMaker.tsx")
text = path.read_text(encoding="utf-8")

replacements = [
    (
        '''type SquadCardDetails = {
  salary: number | null;
  prices: Array<string | null>;
};''',
        '''type SquadCardDetails = {
  salary: number | null;
  prices: Array<string | null>;
  positionOvr: number | null;
};''',
    ),
    (
        '''          const details: SquadCardDetails = {
            salary: Number.isFinite(data.salary) ? data.salary : null,
            prices: Array.isArray(data.prices) ? data.prices : [],
          };''',
        '''          const details: SquadCardDetails = {
            salary: Number.isFinite(data.salary) ? data.salary : null,
            prices: Array.isArray(data.prices) ? data.prices : [],
            positionOvr: Number.isFinite(data.positionOvr) ? data.positionOvr : null,
          };''',
    ),
    (
        '''  const averageOvr = useMemo(() => {
    const ovrs = selectedPlayers
      .map((player) => player.ovr)
      .filter((value): value is number => value !== null);

    if (ovrs.length === 0) return null;
    return Math.round((ovrs.reduce((sum, value) => sum + value, 0) / ovrs.length) * 10) / 10;
  }, [selectedPlayers]);''',
        '''  const averageOvr = useMemo(() => {
    const ovrs = Object.entries(players)
      .map(([slotId, player]) => {
        const officialSlotOvr = cardDetails[slotId]?.positionOvr;
        if (officialSlotOvr !== null && officialSlotOvr !== undefined) {
          return officialSlotOvr;
        }

        const slot = formation.slots.find((item) => item.slotId === slotId);
        return slot?.label === player.position ? player.ovr : null;
      })
      .filter((value): value is number => value !== null);

    if (ovrs.length === 0) return null;
    return Math.round((ovrs.reduce((sum, value) => sum + value, 0) / ovrs.length) * 10) / 10;
  }, [players, cardDetails, formation.slots]);''',
    ),
]

for before, after in replacements:
    count = text.count(before)
    if count != 1:
        raise SystemExit(f"expected exactly one replacement target, found {count}")
    text = text.replace(before, after, 1)

path.write_text(text, encoding="utf-8")
