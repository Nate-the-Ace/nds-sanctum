import { describe, expect, it } from 'vitest';
import { emptyOrders } from '@sanctum/engine';
import { addCast, addTrain, removeCast, removeTrain, setDiscard, setMove, poolPreview } from '../src/model/drafts';

describe('draft helpers', () => {
  it('keeps one move order per group and clears it with null', () => {
    let o = setMove(emptyOrders(), 4, 'e');
    o = setMove(o, 4, 'n');
    o = setMove(o, 5, 's');
    expect(o.move).toEqual([{ groupId: 4, dir: 'n' }, { groupId: 5, dir: 's' }]);
    expect(setMove(o, 4, null).move).toEqual([{ groupId: 5, dir: 's' }]);
  });

  it('adds and removes training and casts, one cast per hand slot', () => {
    let o = addTrain(emptyOrders(), 9, 'swordsman');
    o = addTrain(o, 9, 'clarity');
    expect(o.train).toHaveLength(2);
    expect(removeTrain(o, 0).train).toEqual([{ structureId: 9, as: 'clarity' }]);
    o = addCast(o, 2, { kind: 'globe' });
    o = addCast(o, 2, { kind: 'square', pos: { x: 3, y: 3 } });
    expect(o.cast).toEqual([{ handIndex: 2, target: { kind: 'square', pos: { x: 3, y: 3 } } }]);
    expect(removeCast(o, 2).cast).toEqual([]);
    expect(setDiscard(o, 1).discard).toBe(1);
    expect(setDiscard(setDiscard(o, 1), null).discard).toBeNull();
  });

  it('previews the mana pool after mana training and spell costs', () => {
    const base = { clarity: 1, mystery: 0, order: 0, strife: 2, will: 0, world: 0 };
    const hand = ['a', 'b'];
    const cards = { a: { cost: { strife: 2 } }, b: { cost: { clarity: 2 } } } as never;
    let o = addCast(emptyOrders(), 0, { kind: 'globe' });
    expect(poolPreview(base, hand, cards, o)).toEqual({ pool: { ...base, strife: 0 }, over: false });
    o = addCast(o, 1, { kind: 'globe' });
    expect(poolPreview(base, hand, cards, o).over).toBe(true);
    o = addTrain(o, 1, 'clarity');
    expect(poolPreview(base, hand, cards, o)).toEqual({ pool: { ...base, strife: 0, clarity: 0 }, over: false });
  });
});
