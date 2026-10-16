import { describe, it, expect } from 'vitest';
import { dispatch, takeDamage } from '@sanctum/engine/src/testing';
import { advance, cast, gref, mref, put, stats, world } from './helpers';

describe("Redeemer's Sword", () => {
  it('gives a swordsman +2 hand damage', () => {
    const e = world();
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    expect(cast(e, 'red', 'redeemers-sword', mref(id))).toBe('cast');
    expect(stats(e, id).hand).toBe(4);
  });
});

describe('Filigreed Armor', () => {
  const hand = { kind: 'hand' as const, ignoresArmor: false, magical: false };

  it('adds armor and cuts damage from unenchanted recruits', () => {
    const e = world();
    const victim = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    const attacker = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']).minionIds[0];
    expect(cast(e, 'red', 'filigreed-armor', mref(victim))).toBe('cast');
    expect(stats(e, victim).armor).toBe(2);
    e.state.minions[victim].combat.armor = 2;
    expect(takeDamage(e, victim, 3, hand, attacker)).toBe('bounced'); // 3 - 1 = 2, all soaked
    expect(e.state.minions[victim].hp).toBe(7);
  });

  it('does not cut damage from an enchanted attacker', () => {
    const e = world();
    const victim = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    const attacker = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']).minionIds[0];
    cast(e, 'red', 'filigreed-armor', mref(victim));
    cast(e, 'blue', 'flaming-sword', mref(attacker));
    e.state.minions[victim].combat.armor = 2;
    expect(takeDamage(e, victim, 3, hand, attacker)).toBe('damaged'); // 3 - 2 armor = 1
    expect(e.state.minions[victim].hp).toBe(6);
  });
});

describe('Pacifism', () => {
  it('removes all attacks and damage', () => {
    const e = world();
    const id = put(e, 'red', { x: 4, y: 4 }, ['archer']).minionIds[0];
    expect(cast(e, 'red', 'pacifism', mref(id))).toBe('cast');
    const st = stats(e, id);
    expect(st.handAttacks).toBe(0);
    expect(st.missileAttacks).toBe(0);
    expect(st.noDamage).toBe(true);
  });
});

describe('Vivant', () => {
  it('heals the most damaged other recruit each round and the group each turn', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman', 'swordsman']);
    const [viv, a, b] = g.minionIds;
    expect(cast(e, 'red', 'vivant', mref(viv))).toBe('cast');
    expect(stats(e, viv).noDamage).toBe(true);
    e.state.minions[a].hp = 3;
    e.state.minions[b].hp = 6;
    dispatch(e, 'round:start', gref(g.id), { round: 2 });
    expect(e.state.minions[a].hp).toBe(6);
    expect(e.state.minions[b].hp).toBe(6);
    e.state.minions[viv].hp = 2;
    e.state.minions[a].hp = 1;
    advance(e);
    for (const id of [viv, a, b]) expect(e.state.minions[id].hp).toBe(7);
  });
});

describe('Faerie Fire', () => {
  it('gives archers +2 missile damage until the next combat ends', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['archer', 'swordsman']);
    const [ar, sw] = g.minionIds;
    expect(cast(e, 'red', 'faerie-fire', gref(g.id))).toBe('cast');
    expect(stats(e, ar).missile).toBe(4);
    expect(stats(e, sw).missile).toBe(0);
    dispatch(e, 'combat:after', gref(g.id), {});
    expect(e.state.spells).toHaveLength(0);
  });
  it('needs an archer in the group', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(cast(e, 'red', 'faerie-fire', gref(g.id))).toBe('squandered');
  });
});

describe('Elven Piper', () => {
  it('is castable and changes nothing', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const id = g.minionIds[0];
    expect(cast(e, 'red', 'elven-piper', gref(g.id))).toBe('cast');
    expect(stats(e, id).hand).toBe(2);
  });
});
