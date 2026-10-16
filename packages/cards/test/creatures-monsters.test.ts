import { describe, expect, it } from 'vitest';
import { computeStats, createGroup, dispatch, killMinion, runMovement, spawnMinion, takeDamage } from '@sanctum/engine/src/testing';
import type { MinionSpec } from '@sanctum/engine';
import { card, Target } from '../src/lang';
import { allCards } from '../src/index';
import { castMini, mini, put } from './lang-helpers';

const sq = (x: number, y: number) => ({ kind: 'square' as const, pos: { x, y } });
const monsterOf = (e: ReturnType<typeof mini>) => Object.values(e.state.groups).find((g) => g.kind === 'monster')!;
const spec = (over: Partial<MinionSpec> = {}): MinionSpec => ({
  kind: 'monster', cls: 'monster', name: 'x', ...over,
  base: { hp: 9, level: 1, armor: 0, hand: 2, handAttacks: 1, missile: 0, missileAttacks: 0, walks: [] },
});
const hand = { kind: 'hand' as const, ignoresArmor: false, magical: false };

describe('Salamander', () => {
  it('summons a firewalking Territorial monster and makes its square lava', () => {
    const e = mini(allCards);
    expect(castMini(e, 'red', 'salamander', sq(5, 5))).toBe('cast');
    const g = monsterOf(e);
    const m = e.state.minions[g.minionIds[0]];
    expect(m).toMatchObject({ name: 'Salamander', house: 'war' });
    expect(m.base).toMatchObject({ hand: 4, armor: 0, hp: 12, level: 1 });
    expect(computeStats(e, m.id).walks).toContain('fire');
    expect(e.state.terrain['5,5']).toBe('lava');
    put(e, 'blue', { x: 5, y: 7 }, ['swordsman']);
    runMovement(e);
    expect(g.pos).toEqual({ x: 5, y: 6 });
  });
});

describe('Brimstone Dragon', () => {
  it('needs a mountain or volcano, flies, and casts Fireball at the start of combat', () => {
    const e = mini(allCards);
    expect(castMini(e, 'red', 'brimstone-dragon', sq(5, 5))).toBe('squandered');
    e.state.terrain['5,5'] = 'volcano';
    expect(castMini(e, 'red', 'brimstone-dragon', sq(5, 5))).toBe('cast');
    const g = monsterOf(e);
    expect(computeStats(e, g.minionIds[0]).walks).toContain('flight');
    const foes = put(e, 'blue', { x: 5, y: 6 }, ['swordsman', 'archer']);
    dispatch(e, 'combat:start', { kind: 'group', id: g.id }, { opponent: foes.id });
    for (const id of foes.minionIds) expect(e.state.minions[id].hp).toBe(2);
  });
});

describe('Wyrmling', () => {
  it('is neutral, needs a volcano, and gives Wyrmling Hide to the recruit group that kills it', () => {
    const e = mini(allCards);
    expect(castMini(e, 'red', 'wyrmling', sq(5, 5))).toBe('squandered');
    e.state.terrain['5,5'] = 'volcano';
    e.state.terrain['8,2'] = 'volcano';
    expect(castMini(e, 'red', 'wyrmling', sq(5, 5))).toBe('cast');
    expect(castMini(e, 'red', 'wyrmling', sq(8, 2))).toBe('cast');
    const [first, second] = Object.values(e.state.groups).filter((g) => g.kind === 'monster');
    expect(first.owner).toBe('neutral');
    expect(e.state.minions[first.minionIds[0]].base.level).toBe(0);
    const killers = put(e, 'red', { x: 3, y: 3 }, ['swordsman', 'archer']);
    killMinion(e, first.minionIds[0], killers.minionIds[0], 'kills');
    expect(e.state.spells.some((s) => s.cardId === 'wyrmling-hide' && s.host.kind === 'group' && s.host.id === killers.id)).toBe(true);
    expect(computeStats(e, killers.minionIds[0]).armor).toBe(3);
    expect(computeStats(e, killers.minionIds[1]).armor).toBe(2);
    // killed by a monster: no hide
    const other = createGroup(e, 'blue', { x: 9, y: 9 }, 'monster', 'computer');
    const brute = spawnMinion(e, other.id, spec());
    killMinion(e, second.minionIds[0], brute.id, 'kills');
    expect(e.state.spells.filter((s) => s.cardId === 'wyrmling-hide')).toHaveLength(1);
  });
});

describe('Hellion', () => {
  const run = (house: 'justice' | null) => {
    const e = mini(allCards);
    castMini(e, 'red', 'hellion', sq(5, 5));
    const g = monsterOf(e);
    const foe = put(e, 'blue', { x: 5, y: 6 }, ['swordsman']);
    if (house) e.state.minions[foe.minionIds[0]].house = house;
    dispatch(e, 'combat:start', { kind: 'group', id: g.id }, { opponent: foe.id });
    dispatch(e, 'turn:afterCombat');
    return { e, g };
  };
  it('changes sides after fighting only non-Justice minions', () => {
    const { e, g } = run(null);
    expect(g.owner).toBe('blue');
    expect(e.state.minions[g.minionIds[0]].owner).toBe('blue');
    expect(e.state.spells.find((s) => s.cardId === 'hellion')!.owner).toBe('blue');
  });
  it('stays when it met a Justice minion, or when it did not fight', () => {
    expect(run('justice').g.owner).toBe('red');
    const e = mini(allCards);
    castMini(e, 'red', 'hellion', sq(5, 5));
    dispatch(e, 'turn:afterCombat');
    expect(monsterOf(e).owner).toBe('red');
  });
});

describe('Prismatic Serpent', () => {
  it('hits Death and Despair monsters harder and is immune to their individual spells', () => {
    const probe = (id: string, house: 'death' | 'war') =>
      card({ id, name: id, house, cost: {}, type: 'manifestation', target: { type: 'monster' }, keywords: [] });
    const e = mini([...allCards, probe('death-probe', 'death'), probe('war-probe', 'war')]);
    castMini(e, 'red', 'prismatic-serpent', sq(5, 5));
    const g = monsterOf(e);
    const me = g.minionIds[0];
    const foe = createGroup(e, 'blue', { x: 6, y: 5 }, 'monster', 'computer');
    const dead = spawnMinion(e, foe.id, spec({ house: 'despair' }));
    const plain = spawnMinion(e, foe.id, spec());
    const strike = (victimId: number) =>
      dispatch(e, 'attacker:strikes', { kind: 'minion', id: me }, { victimId, kind: 'hand', round: 2, damage: 4 }).data.damage;
    expect(strike(dead.id)).toBe(8);
    expect(strike(plain.id)).toBe(4);
    expect(castMini(e, 'blue', 'death-probe', { kind: 'minion', id: me })).toBe('squandered');
    expect(castMini(e, 'blue', 'war-probe', { kind: 'minion', id: me })).toBe('cast');
    expect(e.state.minions[me].base).toMatchObject({ hand: 4, armor: 2, hp: 12, level: 2 });
  });
});

describe('Sylph', () => {
  it('has two missile attacks and takes no combat damage from unenchanted recruits', () => {
    const e = mini(allCards);
    castMini(e, 'red', 'sylph', sq(5, 5));
    const me = monsterOf(e).minionIds[0];
    expect(e.state.minions[me].base).toMatchObject({ missile: 3, missileAttacks: 2, hp: 15 });
    const attacker = put(e, 'blue', { x: 5, y: 6 }, ['swordsman']);
    e.state.minions[me].combat.armor = 0;
    expect(takeDamage(e, me, 3, hand, attacker.minionIds[0])).toBe('bounced');
    e.state.spells.push({ id: 900, cardId: 'veteran', owner: 'blue', host: { kind: 'group', id: attacker.id }, visible: true, turnsLeft: null, tokens: {} });
    expect(takeDamage(e, me, 3, hand, attacker.minionIds[0])).toBe('damaged');
  });
});

describe('Undine', () => {
  it('needs water, never moves, attracts enemy groups and dies out of water', () => {
    const e = mini(allCards);
    expect(castMini(e, 'red', 'undine', sq(5, 5))).toBe('squandered');
    e.state.terrain['5,5'] = 'water';
    expect(castMini(e, 'red', 'undine', sq(5, 5))).toBe('cast');
    const g = monsterOf(e);
    const me = g.minionIds[0];
    g.moveOrder = 'e';
    const foe = put(e, 'blue', { x: 5, y: 3 }, ['swordsman']);
    runMovement(e);
    expect(g.pos).toEqual({ x: 5, y: 5 });
    expect(foe.pos).toEqual({ x: 5, y: 4 });
    e.state.terrain['5,5'] = 'plains';
    dispatch(e, 'turn:startAfter');
    expect(e.state.minions[me].status).toBe('dead');
  });
});
