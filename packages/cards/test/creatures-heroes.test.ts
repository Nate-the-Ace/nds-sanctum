import { describe, expect, it } from 'vitest';
import { beginTurn, computeStats, dispatch, killMinion } from '@sanctum/engine/src/testing';
import { allCards } from '../src/index';
import { castMini, mini, put } from './lang-helpers';

const town = (id: number, owner: 'red' | 'blue', x: number, y: number) =>
  ({ id, kind: 'town' as const, pos: { x, y }, owner, manaType: null, novices: 0, turnCount: 2, captured: false });
const find = (e: ReturnType<typeof mini>, name: string) => Object.values(e.state.minions).find((m) => m.name === name)!;

describe('Ngozi', () => {
  it('joins a group and scorches the squares around it, once per game', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    expect(castMini(e, 'red', 'ngozi', { kind: 'group', id: g.id })).toBe('cast');
    const n = find(e, 'Ngozi');
    expect(n).toMatchObject({ nation: 'human', groupId: g.id });
    const s = computeStats(e, n.id);
    expect([s.hand, s.armor, s.maxHp, s.level]).toEqual([2, 1, 7, 2]);
    dispatch(e, 'movement:before');
    for (const k of ['5,4', '3,4', '4,3', '4,5']) expect(e.state.terrain[k]).toBe('barren');
    g.pos = { x: 6, y: 3 };
    dispatch(e, 'group:move', { kind: 'group', id: g.id }, { from: { x: 4, y: 4 }, to: { x: 6, y: 3 } });
    expect(e.state.terrain['7,3']).toBe('barren');
    expect(castMini(e, 'red', 'ngozi', { kind: 'group', id: g.id })).toBe('squandered');
    expect(castMini(e, 'blue', 'ngozi', { kind: 'group', id: put(e, 'blue', { x: 8, y: 4 }, ['archer']).id })).toBe('cast');
  });
});

describe('Vlad Hrothgar', () => {
  it('creates Vlad (Veteran) and Oro (Rite of Growth) at full health', () => {
    const e = mini(allCards);
    e.state.structures[900] = town(900, 'red', 4, 4);
    expect(castMini(e, 'red', 'vlad-hrothgar', { kind: 'structure', id: 900 })).toBe('cast');
    const vlad = computeStats(e, find(e, 'Vlad Hrothgar').id);
    expect([vlad.hand, vlad.armor, vlad.maxHp, vlad.level]).toEqual([3, 2, 11, 2]);
    const oro = find(e, 'Oro');
    expect(oro.nation).toBe('cyclops');
    const o = computeStats(e, oro.id);
    expect([o.hand, o.armor, o.maxHp, o.level]).toEqual([3, 1, 13, 2]);
    expect(find(e, 'Vlad Hrothgar').hp).toBe(11);
    expect(oro.hp).toBe(13);
    expect(castMini(e, 'red', 'vlad-hrothgar', { kind: 'structure', id: 900 })).toBe('squandered');
  });
});

describe('Lienna', () => {
  it('needs a group in forest, is an Elven archer hero, and gives her side the initiative', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(castMini(e, 'red', 'lienna', { kind: 'group', id: g.id })).toBe('squandered');
    e.state.terrain['4,4'] = 'forest';
    expect(castMini(e, 'red', 'lienna', { kind: 'group', id: g.id })).toBe('cast');
    const l = find(e, 'Lienna');
    expect(l).toMatchObject({ nation: 'elf', cls: 'archer' });
    const s = computeStats(e, l.id);
    expect([s.missile, s.armor, s.maxHp, s.level]).toEqual([2, 0, 7, 2]);
    e.state.initiative = 'blue';
    beginTurn(e, false);
    expect(e.state.initiative).toBe('red');
    killMinion(e, l.id, null, 'dies');
    e.state.initiative = 'blue';
    beginTurn(e, false);
    expect(e.state.initiative).toBe('blue');
  });
});

describe('Rite of Growth', () => {
  it('is a Body helper: +1 H and +4 maximum HP', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    e.state.spells.push({ id: 900, cardId: 'rite-of-growth', owner: 'red', host: { kind: 'minion', id: g.minionIds[0] }, visible: true, turnsLeft: null, tokens: {} });
    const s = computeStats(e, g.minionIds[0]);
    expect([s.hand, s.maxHp]).toEqual([3, 11]);
  });
});
