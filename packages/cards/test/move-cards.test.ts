import { describe, it, expect } from 'vitest';
import { expireSpells, runMovement } from '@sanctum/engine/src/testing';
import { cast, gref, put, sref, world } from './helpers';

describe('Forced March', () => {
  it('moves the group two squares along its order', () => {
    const e = world();
    const g = put(e, 'red', { x: 3, y: 3 }, ['swordsman']);
    g.moveOrder = 'e';
    expect(cast(e, 'red', 'forced-march', gref(g.id))).toBe('cast');
    runMovement(e);
    expect(g.pos).toEqual({ x: 5, y: 3 });
  });
});

describe('Amok', () => {
  it('moves a player-controlled group two squares in one random legal direction', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    g.moveOrder = 'e';
    expect(cast(e, 'red', 'amok', gref(g.id))).toBe('cast');
    runMovement(e);
    const d = Math.abs(g.pos!.x - 4) + Math.abs(g.pos!.y - 4);
    expect(d).toBe(2);
    expect(g.pos!.x === 4 || g.pos!.y === 4).toBe(true);
  });
});

describe('Standoff', () => {
  it('cancels every recruit group move order while active', () => {
    const e = world();
    const a = put(e, 'red', { x: 3, y: 3 }, ['swordsman']);
    const b = put(e, 'blue', { x: 6, y: 6 }, ['swordsman']);
    a.moveOrder = 'e';
    b.moveOrder = 'w';
    expect(cast(e, 'red', 'standoff', { kind: 'globe' })).toBe('cast');
    runMovement(e);
    expect(a.pos).toEqual({ x: 3, y: 3 });
    expect(b.pos).toEqual({ x: 6, y: 6 });
  });
});

describe('Standoff duration', () => {
  it('holds for the casting turn and the next, then expires', () => {
    const e = world();
    const a = put(e, 'red', { x: 3, y: 3 }, ['swordsman']);
    a.moveOrder = 'e';
    a.movesTwice = true;
    expect(cast(e, 'red', 'standoff', { kind: 'globe' })).toBe('cast');
    runMovement(e);
    expect(a.pos).toEqual({ x: 3, y: 3 });
    expect(a.movesTwice).toBe(false);
    expireSpells(e);
    expect(e.state.spells.some((sp) => sp.cardId === 'standoff')).toBe(true);
    a.moveOrder = 'e';
    runMovement(e);
    expect(a.pos).toEqual({ x: 3, y: 3 });
    expireSpells(e);
    expect(e.state.spells.some((sp) => sp.cardId === 'standoff')).toBe(false);
    a.moveOrder = 'e';
    runMovement(e);
    expect(a.pos).toEqual({ x: 4, y: 3 });
  });
});

describe("Lienna's Steed", () => {
  it('moves a friendly group one square diagonally toward the enemy and cancels its order', () => {
    const e = world();
    const red = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const blue = put(e, 'blue', { x: 6, y: 6 }, ['swordsman']);
    red.moveOrder = 'n';
    expect(cast(e, 'red', 'liennas-steed', gref(red.id))).toBe('cast');
    expect(red.pos).toEqual({ x: 5, y: 5 });
    expect(red.moveOrder).toBeNull();
    expect(cast(e, 'blue', 'liennas-steed', gref(blue.id))).toBe('cast');
    expect(blue.pos).toEqual({ x: 6, y: 6 }); // its (-1,-1) square (5,5) is now occupied by red
  });
  it('relocating onto a Fountain of Youth heals the group', () => {
    const e = world();
    expect(cast(e, 'red', 'fountain-of-youth', sref(5, 5))).toBe('cast');
    put(e, 'blue', { x: 7, y: 7 }, ['swordsman']);
    const red = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    e.state.minions[red.minionIds[0]].hp = 2;
    expect(cast(e, 'red', 'liennas-steed', gref(red.id))).toBe('cast');
    expect(red.pos).toEqual({ x: 5, y: 5 });
    expect(e.state.minions[red.minionIds[0]].hp).toBe(e.state.minions[red.minionIds[0]].maxHp);
    expect(e.state.spells.some((sp) => sp.cardId === 'youth')).toBe(true);
  });
  it('cannot target an enemy group', () => {
    const e = world();
    const blue = put(e, 'blue', { x: 6, y: 6 }, ['swordsman']);
    expect(cast(e, 'red', 'liennas-steed', gref(blue.id))).toBe('squandered');
  });
  it('stays put when the diagonal square is occupied', () => {
    const e = world();
    const red = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    put(e, 'blue', { x: 5, y: 5 }, ['swordsman']);
    cast(e, 'red', 'liennas-steed', gref(red.id));
    expect(red.pos).toEqual({ x: 4, y: 4 });
  });
});
