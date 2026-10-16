import { describe, it, expect } from 'vitest';
import { takeDamage } from '@sanctum/engine/src/testing';
import { cast, gref, mref, put, putMonster, stats, world } from './helpers';

const hand = { kind: 'hand' as const, ignoresArmor: false, magical: false };

describe('Veteran', () => {
  it('adds hand, armor and hit points, and loses them when dispelled', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const id = g.minionIds[0];
    expect(cast(e, 'red', 'veteran', mref(id))).toBe('cast');
    const st = stats(e, id);
    expect([st.hand, st.armor, st.maxHp]).toEqual([3, 2, 11]);
    expect(e.state.minions[id].hp).toBe(11);
    cast(e, 'blue', 'cleansing-light', gref(g.id));
    expect(e.state.minions[id].hp).toBe(7);
    expect(e.state.minions[id].maxHp).toBe(7);
  });
});

describe('Marksman', () => {
  it('buffs an archer and refuses a swordsman', () => {
    const e = world();
    const a = put(e, 'red', { x: 4, y: 4 }, ['archer']).minionIds[0];
    const s = put(e, 'red', { x: 6, y: 6 }, ['swordsman']).minionIds[0];
    expect(cast(e, 'red', 'marksman', mref(s))).toBe('squandered');
    expect(cast(e, 'red', 'marksman', mref(a))).toBe('cast');
    const st = stats(e, a);
    expect([st.missile, st.missileAttacks, st.maxHp]).toEqual([3, 2, 9]);
    expect(e.state.minions[a].hp).toBe(9);
  });
});

describe('Faerie Knight', () => {
  it('adds 4 hit points and cancels combat damage from unenchanted recruits', () => {
    const e = world();
    const knight = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    const foe = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']).minionIds[0];
    expect(cast(e, 'red', 'faerie-knight', mref(knight))).toBe('cast');
    expect(e.state.minions[knight].hp).toBe(11);
    e.state.minions[knight].combat.armor = 1;
    expect(takeDamage(e, knight, 3, hand, foe)).toBe('bounced');
    expect(e.state.minions[knight].hp).toBe(11);
  });
  it('still takes damage from an enchanted attacker', () => {
    const e = world();
    const knight = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    const foe = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']).minionIds[0];
    cast(e, 'red', 'faerie-knight', mref(knight));
    cast(e, 'blue', 'flaming-sword', mref(foe));
    e.state.minions[knight].combat.armor = 1;
    expect(takeDamage(e, knight, 3, hand, foe)).toBe('damaged');
    expect(e.state.minions[knight].hp).toBe(9);
  });
});

describe('Elixir Vitae', () => {
  it('gives every recruit on the board +6 max hit points, not monsters', () => {
    const e = world();
    const r = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    const b = put(e, 'blue', { x: 6, y: 6 }, ['archer']).minionIds[0];
    const mon = putMonster(e, 'blue', { x: 8, y: 2 }).minionIds[0];
    expect(cast(e, 'red', 'elixir-vitae', { kind: 'globe' })).toBe('cast');
    expect(stats(e, r).maxHp).toBe(13);
    expect(stats(e, b).maxHp).toBe(13);
    expect(stats(e, mon).maxHp).toBe(12);
    expect(e.state.minions[r].hp).toBe(7);
  });
});

describe('Field Surgery', () => {
  it('fully heals damaged members at the price of 1 max hp, permanently', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman']);
    const [hurt, fine] = [...g.minionIds];
    e.state.minions[hurt].hp = 3;
    expect(cast(e, 'blue', 'field-surgery', gref(g.id))).toBe('squandered');
    expect(cast(e, 'red', 'field-surgery', gref(g.id))).toBe('cast');
    expect(e.state.minions[hurt].maxHp).toBe(6);
    expect(e.state.minions[hurt].hp).toBe(6);
    expect(e.state.minions[fine].maxHp).toBe(7);
    cast(e, 'blue', 'cleansing-light', gref(g.id));
    expect(e.state.minions[hurt].maxHp).toBe(6);
  });
});
