import { describe, it, expect } from 'vitest';
import { createGame } from '../src/api';
import { fight } from '../src/combat';
import { indexCards } from '../src/cards';
import { HOUSES } from '../src/houses';
import { NATION_LIST, NATIONS, nationOfHouse } from '../src/nations';
import { recruitSpec, createGroup, spawnMinion } from '../src/units';
import type { MinionSpec } from '../src/types';
import { blankEngine } from './helpers';

describe('nation table', () => {
  it('has 12 nations, one per house', () => {
    expect(NATION_LIST).toHaveLength(12);
    expect(new Set(NATION_LIST.map((n) => NATIONS[n].house))).toEqual(new Set(Object.keys(HOUSES)));
    for (const h of Object.keys(HOUSES) as Array<keyof typeof HOUSES>) expect(NATIONS[nationOfHouse(h)].house).toBe(h);
  });

  it('applies abilities to the recruit base', () => {
    expect(recruitSpec('swordsman', 'cyclops').base.hp).toBe(9);
    expect(recruitSpec('archer', 'misfit').base.hp).toBe(9);
    expect(recruitSpec('swordsman', 'human').base.hp).toBe(7);
    expect(recruitSpec('swordsman', 'dwarf').base.walks).toEqual(['mountain']);
    expect(recruitSpec('swordsman', 'djinn').base.walks).toEqual(['water']);
    expect(recruitSpec('swordsman', 'human')).toMatchObject({ nation: 'human', house: 'war' });
    expect(recruitSpec('swordsman').nation).toBeUndefined();
  });
});

describe('game recruits take their house nation', () => {
  it('starting groups', () => {
    const cards = indexCards([]);
    const state = createGame(
      { seed: 1, decks: { red: { house: 'life', cards: [] }, blue: { house: 'body', cards: [] } },
        options: { towns: 0, flatTerrain: true, skipDeckRules: true } },
      cards,
    );
    const ms = Object.values(state.minions);
    expect(ms.filter((m) => m.owner === 'red').every((m) => m.nation === 'elf' && m.house === 'life' && m.hp === 7)).toBe(true);
    expect(ms.filter((m) => m.owner === 'blue').every((m) => m.nation === 'cyclops' && m.hp === 9 && m.maxHp === 9)).toBe(true);
  });
});

describe('combat nation abilities', () => {
  const dummy = (): MinionSpec => ({
    kind: 'monster', cls: 'monster', name: 'dummy',
    base: { hp: 100, level: 1, armor: 0, hand: 0, handAttacks: 0, missile: 0, missileAttacks: 0, walks: [] },
  });
  const duel = (nation?: 'human') => {
    const e = blankEngine();
    const a = createGroup(e, 'red', { x: 4, y: 4 }, 'recruit', 'player');
    spawnMinion(e, a.id, recruitSpec('swordsman', nation));
    const b = createGroup(e, 'blue', { x: 5, y: 4 }, 'monster', 'computer');
    const v = spawnMinion(e, b.id, dummy());
    fight(e, a.id, b.id);
    return e.state.minions[v.id].hp;
  };
  it('a human basher adds 1 hand damage in round 2 only', () => {
    // rounds 2..10 = 9 attacks of 2 damage
    expect(duel()).toBe(100 - 18);
    expect(duel('human')).toBe(100 - 19);
  });
});
