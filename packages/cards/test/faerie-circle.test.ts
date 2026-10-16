import { describe, expect, it } from 'vitest';
import { computeStats, dispatch, dispel, runMovement } from '@sanctum/engine/src/testing';
import { allCards } from '../src/index';
import { castMini, mini, put } from './lang-helpers';

const setup = () => {
  const e = mini(allCards);
  e.state.terrain['4,4'] = 'forest';
  expect(castMini(e, 'red', 'faerie-circle', { kind: 'square', pos: { x: 4, y: 4 } })).toBe('cast');
  const g = put(e, 'blue', { x: 4, y: 4 }, ['swordsman', 'archer']);
  for (const id of g.minionIds) e.state.minions[id].hp = 2;
  return { e, g };
};
const hop = (e: ReturnType<typeof mini>) => e.state.spells.find((s) => s.cardId === 'faerie-circle-hop');

describe('Faerie Circle', () => {
  it('takes the group away, healed and blessed, and brings it back', () => {
    const { e, g } = setup();
    dispatch(e, 'turn:start');
    expect(g.pos).toBeNull();
    for (const id of g.minionIds) {
      expect(e.state.minions[id].hp).toBe(7);
      expect(computeStats(e, id).level).toBe(2);
    }
    const back = hop(e)!.tokens.back;
    expect(back).toBeGreaterThanOrEqual(e.state.turn + 2);
    expect(back).toBeLessThanOrEqual(e.state.turn + 6);
    e.state.turn = back - 1;
    dispatch(e, 'turn:start');
    expect(g.pos).toBeNull();
    e.state.turn = back;
    dispatch(e, 'turn:start');
    expect(g.pos).toEqual({ x: 4, y: 4 });
    expect(hop(e)).toBeUndefined();
    dispatch(e, 'turn:start'); // blessed: not taken again
    expect(g.pos).toEqual({ x: 4, y: 4 });
  });

  it('waits while the square is occupied', () => {
    const { e, g } = setup();
    dispatch(e, 'turn:start');
    const blocker = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    // the circle would take the blocker too; bless it first so it stays
    e.state.spells.push({ id: 9001, cardId: 'faerie-blessing', owner: 'red', host: { kind: 'minion', id: blocker.minionIds[0] }, visible: true, turnsLeft: null, tokens: {} });
    e.state.turn = hop(e)!.tokens.back;
    dispatch(e, 'turn:start');
    expect(g.pos).toBeNull();
    blocker.pos = { x: 6, y: 6 };
    e.state.turn += 1;
    dispatch(e, 'turn:start');
    expect(g.pos).toEqual({ x: 4, y: 4 });
  });

  it('a blessed group cannot enter a Faerie Circle', () => {
    const { e, g } = setup();
    dispatch(e, 'turn:start');
    e.state.turn = hop(e)!.tokens.back;
    dispatch(e, 'turn:start');
    g.pos = { x: 5, y: 4 };
    g.moveOrder = 'w';
    runMovement(e);
    expect(g.pos).toEqual({ x: 5, y: 4 });
  });

  it('removes the group from the game if the circle is dispelled while it is away', () => {
    const { e, g } = setup();
    dispatch(e, 'turn:start');
    dispel(e, e.state.spells.find((s) => s.cardId === 'faerie-circle')!.id);
    expect(e.state.groups[g.id]).toBeUndefined();
    expect(hop(e)).toBeUndefined();
  });
});
