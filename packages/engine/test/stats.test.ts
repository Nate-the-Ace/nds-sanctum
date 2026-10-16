import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { addSpellRecord } from '../src/spellstore';
import { computeStats, type StatDelta } from '../src/stats';
import { blankEngine, put } from './helpers';

const buff = (id: string, d: StatDelta) =>
  defineCard({ id, name: id, house: 'war', cost: {}, type: 'alteration', target: 'group', stats: () => d });

const onGroup = (e: ReturnType<typeof blankEngine>, cardId: string, groupId: number) =>
  addSpellRecord(e.state, { cardId, owner: 'red', host: { kind: 'group', id: groupId }, visible: true, turnsLeft: null, tokens: {} });

describe('computeStats', () => {
  it('returns base stats with no spells', () => {
    const e = blankEngine();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    expect(computeStats(e, g.minionIds[0])).toMatchObject({ hand: 2, armor: 1, level: 1, handAttacks: 1, missileAttacks: 0 });
    expect(computeStats(e, g.minionIds[1])).toMatchObject({ missile: 2, armor: 0, missileAttacks: 1 });
  });

  it('adds group spell deltas and walks', () => {
    const e = blankEngine([buff('b', { armor: 2, hand: 1, walks: ['water'] })]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    onGroup(e, 'b', g.id);
    const st = computeStats(e, g.minionIds[0]);
    expect(st.armor).toBe(3);
    expect(st.hand).toBe(3);
    expect(st.walks).toContain('water');
  });

  it('clamps level to 0..5 and numbers to >= 0', () => {
    const e = blankEngine([buff('hi', { level: 10 }), buff('lo', { armor: -9, hand: -9 })]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    onGroup(e, 'hi', g.id);
    expect(computeStats(e, g.minionIds[0]).level).toBe(5);
    onGroup(e, 'lo', g.id);
    const st = computeStats(e, g.minionIds[0]);
    expect(st.armor).toBe(0);
    expect(st.hand).toBe(0);
  });

  it('carries the noDamage flag', () => {
    const e = blankEngine([buff('nd', { noDamage: true })]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    onGroup(e, 'nd', g.id);
    expect(computeStats(e, g.minionIds[0]).noDamage).toBe(true);
  });
});
