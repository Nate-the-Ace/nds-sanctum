import { describe, expect, it } from 'vitest';
import { createGroup, dispatch, killMinion, spawnMinion } from '@sanctum/engine/src/testing';
import type { MinionSpec } from '@sanctum/engine';
import { allCards } from '../src/index';
import { castMini, mini, put } from './lang-helpers';

const globe = { kind: 'globe' as const };
const hopperOf = (e: ReturnType<typeof mini>) => Object.values(e.state.groups).find((g) => g.kind === 'monster')!;
const controllers = (e: ReturnType<typeof mini>) => e.state.spells.filter((s) => s.host.kind === 'globe');

describe('Arboriads', () => {
  it('waits off the board, ambushes in forest next to a non-friendly recruit group, then hides', () => {
    const e = mini(allCards);
    expect(castMini(e, 'red', 'arboriads', globe)).toBe('cast');
    const g = hopperOf(e);
    expect(g.pos).toBeNull();
    expect(g.minionIds).toHaveLength(2);
    expect(e.state.minions[g.minionIds[0]].base).toMatchObject({ hand: 3, armor: 1, hp: 7, level: 1 });
    e.state.terrain['5,4'] = 'forest';
    e.state.terrain['2,5'] = 'forest';
    put(e, 'red', { x: 2, y: 4 }, ['swordsman']); // friendly: its forest does not count
    dispatch(e, 'combat:before');
    expect(g.pos).toBeNull();
    put(e, 'blue', { x: 5, y: 5 }, ['swordsman']);
    dispatch(e, 'combat:before');
    expect(g.pos).toEqual({ x: 5, y: 4 });
    dispatch(e, 'turn:afterCombat');
    expect(g.pos).toBeNull();
  });

  it('may be cast twice, gets +4 H against Death minions, and is dispelled when killed', () => {
    const e = mini(allCards);
    castMini(e, 'red', 'arboriads', globe);
    castMini(e, 'red', 'arboriads', globe);
    expect(controllers(e)).toHaveLength(2);
    const g = Object.values(e.state.groups).filter((x) => x.kind === 'monster')[0];
    const spec: MinionSpec = {
      kind: 'monster', cls: 'monster', name: 'd', house: 'death',
      base: { hp: 9, level: 1, armor: 0, hand: 2, handAttacks: 1, missile: 0, missileAttacks: 0, walks: [] },
    };
    const foe = createGroup(e, 'blue', { x: 6, y: 6 }, 'monster', 'computer');
    const victim = spawnMinion(e, foe.id, spec);
    g.pos = { x: 5, y: 4 }; // spells on an off-board group are suspended, so put it on the board first
    const ev = dispatch(e, 'attacker:strikes', { kind: 'minion', id: g.minionIds[0] }, { victimId: victim.id, kind: 'hand', round: 2, damage: 3 });
    expect(ev.data.damage).toBe(7);
    for (const id of [...g.minionIds]) killMinion(e, id, null, 'dies');
    expect(controllers(e)).toHaveLength(1);
  });
});

describe('Firewyrm', () => {
  it('appears in lava or barren land next to any non-friendly group and makes that square lava', () => {
    const e = mini(allCards);
    castMini(e, 'red', 'firewyrm', globe);
    const g = hopperOf(e);
    expect(e.state.minions[g.minionIds[0]].base).toMatchObject({ hand: 2, handAttacks: 2, hp: 12 });
    e.state.terrain['5,4'] = 'barren';
    put(e, 'blue', { x: 5, y: 5 }, ['swordsman']);
    dispatch(e, 'combat:before');
    expect(g.pos).toEqual({ x: 5, y: 4 });
    expect(e.state.terrain['5,4']).toBe('lava');
    dispatch(e, 'turn:afterCombat');
    expect(g.pos).toBeNull();
    expect(e.state.terrain['5,4']).toBe('lava');
  });

  it('stays off the board when there is no eligible square', () => {
    const e = mini(allCards);
    castMini(e, 'red', 'firewyrm', globe);
    put(e, 'blue', { x: 5, y: 5 }, ['swordsman']);
    dispatch(e, 'combat:before');
    expect(hopperOf(e).pos).toBeNull();
  });
});
