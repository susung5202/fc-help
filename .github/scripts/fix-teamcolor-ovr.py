from pathlib import Path

pos = Path('lib/fconline/positionOvr.ts')
s = pos.read_text(encoding='utf-8')
old = '''export function calculatePositionOvrFromText(text: string, position: string): number | null {
  const normalizedPosition = normalizeSquadPosition(position);
  const weights = POSITION_WEIGHTS[normalizedPosition];
  if (!weights) return null;

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

  let weightedTotal = 0;
  for (const [ability, weight] of Object.entries(weights)) {
    const value = abilities[ability];
    if (!Number.isFinite(value)) return null;
    weightedTotal += value * weight;
  }

  return Math.floor(weightedTotal / 100);
}'''
new = '''export function calculatePositionOvrFromAbilities(
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
}'''
if old not in s:
    raise SystemExit('position OVR block not found')
pos.write_text(s.replace(old, new, 1), encoding='utf-8')

route = Path('app/api/squad/team-color/route.ts')
s = route.read_text(encoding='utf-8')
old_import = 'import { calculatePositionOvrFromText } from "@/lib/fconline/positionOvr";'
new_import = 'import { calculatePositionOvrFromAbilities } from "@/lib/fconline/positionOvr";'
if old_import not in s:
    raise SystemExit('route import not found')
s = s.replace(old_import, new_import, 1)

old_apply = '''function applyEffectsToOvr(html: string, position: string, exactBaseOvr: number | null, effects: string[]) {
  if (effects.length === 0) return exactBaseOvr;
  const base = parseAbilityValues(html);
  const stats = Object.keys(base);
  if (stats.length === 0) return exactBaseOvr;
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

  const toText = (values: Record<string, number>) =>
    `능력치 전체 ${Object.entries(values).map(([name, value]) => `${name} ${value}`).join(" ")} 출생`;
  const weightedBase = calculatePositionOvrFromText(toText(base), position);
  const weightedAdjusted = calculatePositionOvrFromText(toText(adjusted), position);
  if (weightedBase === null || weightedAdjusted === null) return exactBaseOvr;
  const delta = weightedAdjusted - weightedBase;
  return exactBaseOvr === null ? weightedAdjusted : exactBaseOvr + delta;
}'''
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
}'''
if old_apply not in s:
    raise SystemExit('applyEffectsToOvr block not found')
route.write_text(s.replace(old_apply, new_apply, 1), encoding='utf-8')
