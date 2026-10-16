import { describe, it, expect } from 'vitest';
import { expireSpells, fight, runCombats } from '@sanctum/engine/src/testing';
import { cast, gref, put, putMonster, world } from './helpers';

const globe = { kind: 'globe' as const };
const hp = (e: ReturnType<typeof world>, id: number) => e.state.minions[id].hp;

describe('Skirmish', () => {
  it('ends the combat at round 3 and is dispelled afterwards', () => {
    const e = world();
    const red = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    const blue = put(e, 'blue', { x: 5, y: 4 }, ['archer']);
    const [a, b] = [red.minionIds[0], blue.minionIds[0]];
    expect(cast(e, 'red', 'skirmish', gref(red.id))).toBe('cast');
    fight(e, red.id, blue.id);
    expect([hp(e, a), hp(e, b)]).toEqual([4, 4]);
    expect(e.state.spells).toHaveLength(0);
  });
});

describe('Strategic Withdrawals', () => {
  it('ends every combat at the start of round 7', () => {
    const e = world();
    const red = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const blue = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']);
    const [a, b] = [red.minionIds[0], blue.minionIds[0]];
    expect(cast(e, 'red', 'strategic-withdrawals', globe)).toBe('cast');
    fight(e, red.id, blue.id);
    expect([hp(e, a), hp(e, b)]).toEqual([2, 2]);
  });
});

describe("Lienna's Sigil", () => {
  it('ends combat against a monster group at once', () => {
    const e = world();
    const red = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const mon = putMonster(e, 'blue', { x: 5, y: 4 });
    const [a, m] = [red.minionIds[0], mon.minionIds[0]];
    expect(cast(e, 'red', 'liennas-sigil', gref(red.id))).toBe('cast');
    fight(e, red.id, mon.id);
    expect([hp(e, a), hp(e, m)]).toEqual([7, 12]);
  });
  it('does nothing against recruits', () => {
    const e = world();
    const red = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const blue = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']);
    cast(e, 'red', 'liennas-sigil', gref(red.id));
    fight(e, red.id, blue.id);
    expect(e.state.groups[blue.id]).toBeUndefined();
  });
});

describe('Armistice', () => {
  it('stops all combat for the casting turn plus two, then lapses', () => {
    const e = world();
    const red = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const blue = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']);
    const [a, b] = [red.minionIds[0], blue.minionIds[0]];
    expect(cast(e, 'red', 'armistice', globe)).toBe('cast');
    runCombats(e);
    expect([hp(e, a), hp(e, b)]).toEqual([7, 7]);
    expireSpells(e);
    expireSpells(e);
    expect(e.state.spells).toHaveLength(1);
    expireSpells(e);
    expect(e.state.spells).toHaveLength(0);
    runCombats(e);
    expect(e.state.groups[blue.id]).toBeUndefined();
  });
});
