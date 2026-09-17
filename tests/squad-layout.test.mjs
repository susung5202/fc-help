import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../lib/fconline/squadLayout.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const layout = {};
new Function('exports', compiled.outputText)(layout);
const { POSITION_ZONES, findPositionZone, formationName, restorePositions } = layout;
const slots = (labels) => labels.split(' ').map((label, i) => ({ slotId: `p${i}`, label, x: 50, y: label === 'GK' ? 86 : 65 }));

test('ST to CB changes 4-1-2-3 into 5-1-2-2 without counting GK', () => {
  const base = slots('LW ST RW CM CM CDM LB CB CB RB GK');
  const presets = { '4-1-2-3': { slots: base } };
  assert.equal(formationName(base, presets), '4-1-2-3');
  const moved = base.map((slot) => slot.slotId === 'p1' ? { ...slot, label: 'CB' } : slot);
  assert.equal(formationName(moved, presets), '5-1-2-2');
  assert.equal(moved.length, 11);
});

test('familiar preset names remain stable and wings count as attackers', () => {
  const base = slots('ST ST LM CAM RM CDM CDM CB CB CB GK');
  assert.equal(formationName(base, { '3-5-2': { slots: base } }), '3-5-2');
  assert.equal(formationName(slots('LW ST RW CM CM CM LB CB CB RB GK'), {}), '4-3-3');
});

test('rendered zone centers and boundaries use the same hit testing geometry', () => {
  for (const zone of POSITION_ZONES) {
    assert.equal(findPositionZone(zone.left + zone.width / 2, zone.top + zone.height / 2)?.label, zone.label);
  }
  assert.equal(findPositionZone(50, 65)?.label, 'CB');
  assert.equal(findPositionZone(50, 45)?.label, 'CDM');
  for (const [x, y] of [[0, 65], [100, 65], [50, 86], [-1, 0], [50, NaN]]) assert.equal(findPositionZone(x, y), null);
});

test('saved custom positions restore safely and legacy saves still work', () => {
  const base = slots('ST GK');
  assert.deepEqual(restorePositions(undefined, base), {});
  assert.deepEqual(restorePositions({ p0: { x: 50, y: 65, label: 'CB' } }, base), { p0: { slotId: 'p0', x: 50, y: 65, label: 'CB' } });
  for (const candidate of [{ x: Infinity, y: 65, label: 'CB' }, { x: 50, y: 86, label: 'GK' }, { x: 50, y: 65, label: 'ST' }]) {
    assert.deepEqual(restorePositions({ p0: candidate, p1: candidate, invalid: candidate }, base), {});
  }
});
