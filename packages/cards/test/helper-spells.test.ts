import { describe, it, expect } from 'vitest';
import { dispatch, fight } from '@sanctum/engine/src/testing';
import { cast, gref, mref, put, sref, stats, world } from './helpers';

const countOf = (e: ReturnType<typeof world>, cardId: string) => e.state.spells.filter((s) => s.cardId === cardId).length;

describe('Thermites', () => {
  it('gives the victim cumulative -1 armor on each hit', () => {
    const e = world();
    const red = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const blue = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']);
    const [rid, bid] = [red.minionIds[0], blue.minionIds[0]];
    expect(cast(e, 'red', 'thermites', mref(rid))).toBe('cast');
    dispatch(e, 'attacker:hits', mref(rid), { victimId: bid });
    expect(stats(e, bid).armor).toBe(0);
    dispatch(e, 'attacker:hits', mref(rid), { victimId: bid });
    expect(countOf(e, 'thermite-damage')).toBe(2);
  });

  it('shortens a real fight: the armored victim dies in round 5', () => {
    const e = world();
    const red = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const blue = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']);
    const rid = red.minionIds[0];
    cast(e, 'red', 'thermites', mref(rid));
    fight(e, red.id, blue.id);
    expect(e.state.groups[blue.id]).toBeUndefined();
    expect(e.state.minions[rid].hp).toBe(4);
  });
});

describe('Fountain of Youth', () => {
  it('fully heals a group entering the square and lowers its levels', () => {
    const e = world();
    expect(cast(e, 'red', 'fountain-of-youth', sref(5, 5))).toBe('cast');
    const g = put(e, 'red', { x: 5, y: 5 }, ['swordsman', 'swordsman']);
    const [a, b] = [...g.minionIds];
    e.state.minions[a].hp = 3;
    dispatch(e, 'group:enter', gref(g.id), {});
    expect(e.state.minions[a].hp).toBe(7);
    expect(stats(e, a).level).toBe(0);
    expect(stats(e, b).level).toBe(0);
    expect(countOf(e, 'youth')).toBe(2);
  });
});

describe('Faerie Glade', () => {
  it('lowers enemy recruit levels on every contiguous forest square', () => {
    const e = world();
    for (const k of ['4,4', '5,4', '8,2']) e.state.terrain[k] = 'forest';
    expect(cast(e, 'red', 'faerie-glade', sref(4, 4))).toBe('cast');
    expect(countOf(e, 'faerie-glade-square')).toBe(2);
    const enemy = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']).minionIds[0];
    const friend = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    const far = put(e, 'blue', { x: 8, y: 2 }, ['swordsman']).minionIds[0];
    expect(stats(e, enemy).level).toBe(0);
    expect(stats(e, friend).level).toBe(1);
    expect(stats(e, far).level).toBe(1);
  });
  it('does not stack when cast twice', () => {
    const e = world();
    for (const k of ['4,4', '5,4']) e.state.terrain[k] = 'forest';
    expect(cast(e, 'red', 'faerie-glade', sref(4, 4))).toBe('cast');
    expect(cast(e, 'red', 'faerie-glade', sref(4, 4))).toBe('cast');
    expect(countOf(e, 'faerie-glade-square')).toBe(2);
    const enemy = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']).minionIds[0];
    expect(stats(e, enemy).level).toBe(0);
  });
  it('a square stops lowering levels once it is no longer forest', () => {
    const e = world();
    for (const k of ['4,4', '5,4']) e.state.terrain[k] = 'forest';
    cast(e, 'red', 'faerie-glade', sref(4, 4));
    cast(e, 'red', 'plains', sref(5, 4));
    expect(countOf(e, 'faerie-glade-square')).toBe(1);
    const enemy = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']).minionIds[0];
    expect(stats(e, enemy).level).toBe(1);
  });
});
