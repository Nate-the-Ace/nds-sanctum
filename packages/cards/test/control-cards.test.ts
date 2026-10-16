import { describe, expect, it } from 'vitest';
import type { Ref } from '@sanctum/engine';
import { computeStats, dispatch, expireSpells, recheck, runMovement } from '@sanctum/engine/src/testing';
import { printTarget, Target } from '../src/lang';
import { allCards } from '../src/index';
import { castMini, mini, put } from './lang-helpers';

const mref = (id: number): Ref => ({ kind: 'minion', id });
const gref = (id: number): Ref => ({ kind: 'group', id });
const sq = (x: number, y: number): Ref => ({ kind: 'square', pos: { x, y } });
const town = (id: number, owner: 'red' | 'blue', x: number, y: number) =>
  ({ id, kind: 'town' as const, pos: { x, y }, owner, manaType: null, novices: 0, turnCount: 2, captured: false });

describe('target modifiers', () => {
  it('print in the order of the scraped texts', () => {
    expect(printTarget(Target.recruitGroup.playerControlled.atMost(3).notInStructure.spec))
      .toBe('Player-controlled recruit group of three or less not in a structure.');
    expect(printTarget(Target.recruitGroup.friendly.atLeast(2).notInStructure.spec))
      .toBe('Friendly recruit group of two or more not in a structure.');
  });
});

describe('General', () => {
  it('gives friendly swordsmen in the four adjacent squares +1 M', () => {
    const e = mini(allCards);
    const hq = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    expect(castMini(e, 'blue', 'general', mref(hq.minionIds[0]))).toBe('squandered');
    expect(castMini(e, 'red', 'general', mref(hq.minionIds[0]))).toBe('cast');
    const near = put(e, 'red', { x: 5, y: 4 }, ['swordsman', 'archer']);
    const far = put(e, 'red', { x: 6, y: 4 }, ['swordsman']);
    const foe = put(e, 'blue', { x: 4, y: 5 }, ['swordsman']);
    expect(computeStats(e, near.minionIds[0]).missile).toBe(1);
    expect(computeStats(e, near.minionIds[1]).missile).toBe(2);
    expect(computeStats(e, far.minionIds[0]).missile).toBe(0);
    expect(computeStats(e, foe.minionIds[0]).missile).toBe(0);
  });
});

describe('Weapon Master', () => {
  it('gives each class the other attack and opens it to both kinds of spell', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    const [sw, ar] = g.minionIds;
    expect(castMini(e, 'red', 'yeoman', mref(sw))).toBe('squandered');
    expect(castMini(e, 'red', 'weapon-master', mref(sw))).toBe('cast');
    expect(castMini(e, 'red', 'weapon-master', mref(ar))).toBe('cast');
    const s = computeStats(e, sw);
    expect([s.hand, s.handAttacks, s.missile, s.missileAttacks, s.dualClass]).toEqual([2, 1, 2, 1, true]);
    const a = computeStats(e, ar);
    expect([a.hand, a.handAttacks, a.missile, a.missileAttacks]).toEqual([2, 1, 2, 1]);
    expect(castMini(e, 'red', 'yeoman', mref(sw))).toBe('cast');
    expect(castMini(e, 'red', 'flaming-sword', mref(ar))).toBe('cast');
  });
});

describe('Renegades', () => {
  it('turns a small player group neutral and computer-controlled', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman', 'archer']);
    const prey = put(e, 'blue', { x: 4, y: 7 }, ['swordsman']);
    expect(castMini(e, 'blue', 'renegades', gref(g.id))).toBe('cast');
    expect(g).toMatchObject({ owner: 'neutral', control: 'computer', botId: 'renegades' });
    expect(e.state.groupSeq.neutral).toContain(g.id);
    runMovement(e);
    expect(g.pos).toEqual({ x: 4, y: 5 }); // closes on the nearest hostile recruit group
    expect(prey.pos).toEqual({ x: 4, y: 7 });
  });
  it('needs a player-controlled group of three or less, not in a structure', () => {
    const e = mini(allCards);
    const four = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman', 'archer', 'archer']);
    expect(castMini(e, 'blue', 'renegades', gref(four.id))).toBe('squandered');
    const housed = put(e, 'red', { x: 6, y: 3 }, ['swordsman']);
    e.state.structures[900] = town(900, 'red', 6, 3);
    expect(castMini(e, 'blue', 'renegades', gref(housed.id))).toBe('squandered');
    const bot = put(e, 'red', { x: 2, y: 6 }, ['swordsman']);
    bot.control = 'computer';
    expect(castMini(e, 'blue', 'renegades', gref(bot.id))).toBe('squandered');
  });
});

describe('Lava Flow', () => {
  it('makes a volcano that erupts into eligible neighbours, whose lava cools to barren', () => {
    const e = mini(allCards);
    e.state.terrain['4,4'] = 'mountain';
    e.state.terrain['4,3'] = 'mountain';
    e.state.structures[900] = town(900, 'blue', 5, 4);
    expect(castMini(e, 'red', 'lava-flow', sq(4, 4))).toBe('cast');
    expect(e.state.terrain['4,4']).toBe('volcano');
    let lava: string[] = [];
    for (let i = 0; i < 40 && lava.length === 0; i++) {
      dispatch(e, 'turn:start');
      lava = ['3,4', '4,5'].filter((k) => e.state.terrain[k] === 'lava');
    }
    expect(lava.length).toBeGreaterThanOrEqual(1);
    expect(e.state.terrain['4,3']).toBe('mountain');
    expect(e.state.terrain['5,4']).toBe('plains');
    for (let i = 0; i < 3; i++) expireSpells(e);
    for (const k of lava) expect(e.state.terrain[k]).toBe('barren');
  });
  it('is dispelled when its square stops being volcano', () => {
    const e = mini(allCards);
    e.state.terrain['4,4'] = 'volcano';
    castMini(e, 'red', 'lava-flow', sq(4, 4));
    e.state.terrain['4,4'] = 'plains';
    recheck(e, sq(4, 4));
    expect(e.state.spells.some((s) => s.cardId === 'lava-flow')).toBe(false);
  });
});
