import { describe, expect, it } from 'vitest';
import { canEnterSquare, runMovement } from '@sanctum/engine/src/testing';
import { allCards } from '../src/index';
import { castMini, mini, put } from './lang-helpers';

const sq = (x: number, y: number) => ({ kind: 'square' as const, pos: { x, y } });
const town = (id: number, owner: 'red' | 'blue', x: number, y: number) =>
  ({ id, kind: 'town' as const, pos: { x, y }, owner, manaType: null, novices: 0, turnCount: 2, captured: false });

describe('Fae Quadrille', () => {
  it('heals the four adjacent squares when cast, and its square cannot be entered', () => {
    const e = mini(allCards);
    const west = put(e, 'red', { x: 4, y: 5 }, ['swordsman']);
    const north = put(e, 'blue', { x: 5, y: 4 }, ['archer']);
    const diag = put(e, 'red', { x: 6, y: 6 }, ['swordsman']);
    for (const g of [west, north, diag]) e.state.minions[g.minionIds[0]].hp = 3;
    expect(castMini(e, 'red', 'fae-quadrille', sq(5, 5))).toBe('cast');
    expect(e.state.minions[west.minionIds[0]].hp).toBe(7);
    expect(e.state.minions[north.minionIds[0]].hp).toBe(7);
    expect(e.state.minions[diag.minionIds[0]].hp).toBe(3);
    expect(e.state.spells.find((s) => s.cardId === 'fae-quadrille')!.turnsLeft).toBe(2);
    west.moveOrder = 'e';
    runMovement(e);
    expect(west.pos).toEqual({ x: 4, y: 5 });
  });
});

describe('Terrain Bind', () => {
  it('keeps the group on its own terrain; structures count as plains', () => {
    const e = mini(allCards);
    const g = put(e, 'blue', { x: 4, y: 4 }, ['swordsman']);
    e.state.terrain['5,4'] = 'forest';
    e.state.structures[900] = town(900, 'blue', 4, 3);
    expect(castMini(e, 'red', 'terrain-bind', { kind: 'group', id: g.id })).toBe('cast');
    expect(e.state.spells.find((s) => s.cardId === 'terrain-bind')!.turnsLeft).toBe(3);
    expect(canEnterSquare(e, g, { x: 5, y: 4 })).toBe(false);
    expect(canEnterSquare(e, g, { x: 4, y: 5 })).toBe(true);
    expect(canEnterSquare(e, g, { x: 4, y: 3 })).toBe(true);
    g.pos = { x: 5, y: 4 }; // now in forest: plains and the town are out of reach
    expect(canEnterSquare(e, g, { x: 4, y: 4 })).toBe(false);
    expect(canEnterSquare(e, g, { x: 6, y: 4 })).toBe(false);
  });
});
