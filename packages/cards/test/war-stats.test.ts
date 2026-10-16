import { describe, it, expect } from 'vitest';
import { cast, gref, mref, put, sref, stats, world } from './helpers';

describe('Flaming Sword', () => {
  it('gives a swordsman +2 hand damage', () => {
    const e = world();
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    expect(cast(e, 'red', 'flaming-sword', mref(id))).toBe('cast');
    expect(stats(e, id).hand).toBe(4);
  });
  it('cannot target an archer', () => {
    const e = world();
    const id = put(e, 'red', { x: 4, y: 4 }, ['archer']).minionIds[0];
    expect(cast(e, 'red', 'flaming-sword', mref(id))).toBe('squandered');
    expect(e.state.spells).toHaveLength(0);
  });
});

describe('Bloodlust', () => {
  it('gives a swordsman +1 attack each round', () => {
    const e = world();
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    expect(cast(e, 'red', 'bloodlust', mref(id))).toBe('cast');
    expect(stats(e, id).handAttacks).toBe(2);
  });
});

describe('Legionnaires', () => {
  it('buffs swordsmen in the group only', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    const [sw, ar] = g.minionIds;
    expect(cast(e, 'red', 'legionnaires', gref(g.id))).toBe('cast');
    expect(stats(e, sw).hand).toBe(3);
    expect(stats(e, ar).hand).toBe(0);
  });
  it('needs a swordsman in the group', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    expect(cast(e, 'red', 'legionnaires', gref(g.id))).toBe('squandered');
  });
});

describe("Ngozi's Way", () => {
  it('gives every member +1 level', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    const ids = [...g.minionIds];
    expect(cast(e, 'red', 'ngozis-way', gref(g.id))).toBe('cast');
    for (const id of ids) expect(stats(e, id).level).toBe(2);
  });
});

describe('Palisade', () => {
  it('gives archers in the square +1 armor', () => {
    const e = world();
    expect(cast(e, 'red', 'palisade', sref(5, 5))).toBe('cast');
    const inside = put(e, 'red', { x: 5, y: 5 }, ['archer']).minionIds[0];
    const outside = put(e, 'red', { x: 6, y: 6 }, ['archer']).minionIds[0];
    expect(stats(e, inside).armor).toBe(1);
    expect(stats(e, outside).armor).toBe(0);
  });
});

describe('War Drums', () => {
  it('is castable and changes nothing', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const id = g.minionIds[0];
    expect(cast(e, 'red', 'war-drums', gref(g.id))).toBe('cast');
    expect(stats(e, id).hand).toBe(2);
    expect(stats(e, id).armor).toBe(1);
  });
});

describe('Swashbuckler', () => {
  it('turns armor into levels', () => {
    const e = world();
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    expect(cast(e, 'red', 'swashbuckler', mref(id))).toBe('cast');
    const st = stats(e, id);
    expect(st.level).toBe(2);
    expect(st.armor).toBe(0);
  });
  it('counts all armor at cast time, including spell armor', () => {
    const e = world();
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    expect(cast(e, 'blue', 'filigreed-armor', mref(id))).toBe('cast');
    expect(stats(e, id).armor).toBe(2);
    expect(cast(e, 'red', 'swashbuckler', mref(id))).toBe('cast');
    const st = stats(e, id);
    expect(st.level).toBe(3);
    expect(st.armor).toBe(0);
  });
  it('cannot be dispelled by Cleansing Light', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const id = g.minionIds[0];
    cast(e, 'red', 'swashbuckler', mref(id));
    expect(cast(e, 'blue', 'cleansing-light', gref(g.id))).toBe('cast');
    expect(e.state.spells.map((sp) => sp.cardId)).toEqual(['swashbuckler']);
    expect(stats(e, id).level).toBe(2);
    expect(stats(e, id).armor).toBe(0);
  });
});
