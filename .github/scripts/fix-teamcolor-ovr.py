from pathlib import Path

pos = Path('lib/fconline/positionOvr.ts')
s = pos.read_text(encoding='utf-8')
start = s.index('export function calculatePositionOvrFromText')
new_tail = '''export function calculatePositionOvrFromAbilities(
  abilities: Record<string, number>,
  position: string
): number | null {
  const normalizedPosition = normalizeSquadPosition(position);
  const weights = POSITION_WEIGHTS[normalizedPosition];
  if (!weights) return null;

  let weightedTotal = 0;
  for (const [ability, weight] of Object.entries(weights)) {
    const value = abilities[ability];
    if (!Number.isFinite(value)) return null;
    weightedTotal += value * weight;
  }

  return Math.floor(weightedTotal / 100);
}

export function calculatePositionOvrFromText(text: string, position: string): number | null {
  const abilityMarker = text.indexOf("능력치 전체");
  const birthMarker = text.indexOf("출생", abilityMarker >= 0 ? abilityMarker : 0);
  const section = text.slice(
    abilityMarker >= 0 ? abilityMarker : 0,
    birthMarker >= 0 ? birthMarker : text.length
  );

  const abilities: Record<string, number> = {};
  for (const name of ABILITY_NAMES) {
    const match = section.match(new RegExp(`${escapeRegExp(name)}\\s+(\\d{1,3})(?=\\s|$)`));
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value)) abilities[name] = value;
  }

  return calculatePositionOvrFromAbilities(abilities, position);
}
'''
pos.write_text(s[:start] + new_tail, encoding='utf-8')

route = Path('app/api/squad/team-color/route.ts')
s = route.read_text(encoding='utf-8')
s = s.replace(
    'import { calculatePositionOvrFromText } from "@/lib/fconline/positionOvr";',
    'import { calculatePositionOvrFromAbilities } from "@/lib/fconline/positionOvr";',
    1,
)
start = s.index('function applyEffectsToOvr(')
end = s.index('\nfunction gainForEffect', start)
new_apply = '''function applyEffectsToOvr(html: string, position: string, exactBaseOvr: number | null, effects: string[]) {
  if (effects.length === 0) return exactBaseOvr;

  const overallBonus = effects.reduce(
    (sum, effect) => sum + Number(effect.match(/전체 능력치\\s*\\+(\\d+)/)?.[1] ?? 0),
    0
  );
  const base = parseAbilityValues(html);
  const stats = Object.keys(base);

  // 전체 능력치 보너스는 모든 포지션 가중치에 동일하게 적용되므로,
  // 세부 능력치 파싱이 실패해도 최종 OVR에서 절대 누락시키지 않는다.
  if (stats.length === 0) {
    return exactBaseOvr === null ? null : exactBaseOvr + overallBonus;
  }

  const adjusted = { ...base };
  for (const effect of effects) {
    const overall = Number(effect.match(/전체 능력치\\s*\\+(\\d+)/)?.[1] ?? 0);
    if (overall > 0) {
      for (const stat of stats) adjusted[stat] = (adjusted[stat] ?? 0) + overall;
    }
    for (const stat of STAT_NAMES) {
      if (stat === "전체 능력치") continue;
      const amount = Number(effect.match(new RegExp(`${escapeRegExp(stat)}\\s*\\+(\\d+)`))?.[1] ?? 0);
      if (amount > 0 && adjusted[stat] !== undefined) adjusted[stat] += amount;
    }
  }

  const weightedBase = calculatePositionOvrFromAbilities(base, position);
  const weightedAdjusted = calculatePositionOvrFromAbilities(adjusted, position);
  if (weightedBase === null || weightedAdjusted === null) {
    return exactBaseOvr === null ? null : exactBaseOvr + overallBonus;
  }

  const delta = weightedAdjusted - weightedBase;
  return exactBaseOvr === null ? weightedAdjusted : exactBaseOvr + delta;
}
'''
route.write_text(s[:start] + new_apply + s[end:], encoding='utf-8')
