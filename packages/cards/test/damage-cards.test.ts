import { describe, expect, it } from 'vitest';
import { computeStats, createGroup, dispatch, fight, recruitSpec, spawnMinion } from '@sanctum/engine/src/testing';
import type { MinionSpec, Ref } from '@sanctum/engine';
import { allCards } from '../src/index';
import { castMini, mini, put } from './lang-helpers';

const mref = (id: number): Ref => ({ kind: 'minion', id });
const gref = (id: number): Ref => ({ kind: 'group', id });
const town = (id: number, owner: 'red' | 'blue', x: number, y: number) =>
  ({ id, kind: 'town' as const, pos: { x, y }, owner, manaType: null, novices: 0, turnCount: 2, captured: false });
const dummy = (armor = 0): MinionSpec => ({
  kind: 'monster', cls: 'monster', name: 'dummy',
  base: { hp: 100, level: 1, armor, hand: 0, handAttacks: 0, missile: 0, missileAttacks: 0, walks: [] },
});
/** The payload of one strike after every handler ran. */
const strike = (e: ReturnType<typeof mini>, attacker: number, victim: number, kind: 'hand' | 'missile' = 'missile') =>
  dispatch(e, 'attacker:strikes', mref(attacker), { victimId: victim, kind, round: 2, damage: 2, magical: false, heals: false }).data;

describe('Cadre', () => {
  it('gives the archers +1 M against swordsmen only', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['archer', 'swordsman']);
    const swords = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']);
    const bows = put(e, 'blue', { x: 4, y: 5 }, ['archer']);
    expect(castMini(e, 'red', 'cadre', gref(g.id))).toBe('cast');
    expect(strike(e, g.minionIds[0], swords.minionIds[0]).damage).toBe(3);
    expect(strike(e, g.minionIds[0], bows.minionIds[0]).damage).toBe(2);
    expect(strike(e, g.minionIds[1], swords.minionIds[0], 'hand').damage).toBe(2);
  });
  it('needs archers in the group', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(castMini(e, 'red', 'cadre', gref(g.id))).toBe('squandered');
  });
});

describe('Flaming Arrows', () => {
  it('+3 M against groups in forest or a structure', () => {
    const e = mini(allCards);
    const a = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    const foe = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']);
    expect(castMini(e, 'red', 'flaming-arrows', mref(a.minionIds[0]))).toBe('cast');
    expect(strike(e, a.minionIds[0], foe.minionIds[0]).damage).toBe(2);
    e.state.terrain['5,4'] = 'forest';
    expect(strike(e, a.minionIds[0], foe.minionIds[0]).damage).toBe(5);
    e.state.terrain['5,4'] = 'plains';
    e.state.structures[900] = town(900, 'blue', 5, 4);
    expect(strike(e, a.minionIds[0], foe.minionIds[0]).damage).toBe(5);
  });
  it('burns a forest it hit into barren land after all combat', () => {
    const e = mini(allCards);
    const a = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    const foe = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']);
    e.state.terrain['5,4'] = 'forest';
    castMini(e, 'red', 'flaming-arrows', mref(a.minionIds[0]));
    dispatch(e, 'attacker:hits', mref(a.minionIds[0]), { victimId: foe.minionIds[0] });
    expect(e.state.terrain['5,4']).toBe('forest');
    dispatch(e, 'turn:afterCombat');
    expect(e.state.terrain['5,4']).toBe('barren');
  });
});

describe('Yeoman', () => {
  it('+1 M, and its missiles ignore armor', () => {
    const e = mini(allCards);
    const a = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    expect(castMini(e, 'red', 'yeoman', mref(a.minionIds[0]))).toBe('cast');
    expect(computeStats(e, a.minionIds[0]).missile).toBe(3);
    const b = createGroup(e, 'blue', { x: 5, y: 4 }, 'monster', 'computer');
    const v = spawnMinion(e, b.id, dummy(3));
    fight(e, a.id, b.id);
    // round 1 shot: 3 - 1; rounds 2-10: 3 each; armor 3 never soaks
    expect(e.state.minions[v.id].hp).toBe(100 - (2 + 9 * 3));
  });
  it('kills a Keeper it hits, then is dispelled', () => {
    const e = mini(allCards);
    const a = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    castMini(e, 'red', 'yeoman', mref(a.minionIds[0]));
    const k = createGroup(e, 'blue', { x: 5, y: 4 }, 'recruit', 'player');
    const keeper = spawnMinion(e, k.id, recruitSpec('swordsman', 'keeper'));
    dispatch(e, 'attacker:hits', mref(a.minionIds[0]), { victimId: keeper.id });
    expect(e.state.minions[keeper.id].status).toBe('dead');
    expect(e.state.spells.some((s) => s.cardId === 'yeoman')).toBe(false);
  });
});

describe('Fae Gift', () => {
  it('turns the swordsman into an Elf whose hits heal', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(castMini(e, 'red', 'fae-gift', mref(g.minionIds[0]))).toBe('cast');
    expect(e.state.minions[g.minionIds[0]]).toMatchObject({ nation: 'elf', house: 'life' });
    const b = createGroup(e, 'blue', { x: 5, y: 4 }, 'monster', 'computer');
    const v = spawnMinion(e, b.id, dummy());
    e.state.minions[v.id].hp = 50;
    fight(e, g.id, b.id);
    expect(e.state.minions[v.id].hp).toBe(68);
  });
});

describe('Cannon', () => {
  it('hits the opposing group at start of combat when its owner\'s group has a Human archer', () => {
    const e = mini(allCards);
    const gunners = createGroup(e, 'red', { x: 4, y: 4 }, 'recruit', 'player');
    spawnMinion(e, gunners.id, recruitSpec('archer', 'human'));
    const plain = put(e, 'red', { x: 2, y: 6 }, ['archer']);
    const foe = put(e, 'blue', { x: 5, y: 4 }, ['swordsman', 'swordsman']);
    expect(castMini(e, 'red', 'cannon', { kind: 'globe' })).toBe('cast');
    dispatch(e, 'combat:start', gref(plain.id), { opponent: foe.id });
    expect(foe.minionIds.map((id) => e.state.minions[id].hp)).toEqual([7, 7]);
    dispatch(e, 'combat:start', gref(foe.id), { opponent: gunners.id });
    expect(e.state.minions[gunners.minionIds[0]].hp).toBe(7);
    dispatch(e, 'combat:start', gref(gunners.id), { opponent: foe.id });
    expect(foe.minionIds.map((id) => e.state.minions[id].hp)).toEqual([6, 6]);
  });
});
