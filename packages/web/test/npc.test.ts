import { describe, expect, it } from 'vitest';
import { cardIndex, starterDeck } from '@sanctum/cards';
import {
  checkOrders, chooseMana, confirmOrders, createGame, emptyOrders, houseMana, submitOrders,
  SIDES, type GameState, type Orders, type Side,
} from '@sanctum/engine';
import { npcOrders, npcPickMana } from '../src/model/npc';

function game(seed: number): GameState {
  return createGame({ seed, decks: { red: starterDeck('war'), blue: starterDeck('life') } }, cardIndex);
}

/** Both sides NPC: resolve mana choices, then submit and confirm each side's orders. */
function playTurns(seed: number, turns: number): { state: GameState; orders: Record<Side, Orders[]> } {
  let s = game(seed);
  const orders: Record<Side, Orders[]> = { red: [], blue: [] };
  for (let t = 0; t < turns && s.phase !== 'over'; t++) {
    while (s.phase === 'choose-mana') {
      const id = s.pendingMana[0];
      const owner = s.structures[id].owner as Side;
      const r = chooseMana(s, cardIndex, owner, id, npcPickMana(s, cardIndex, owner, id));
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    }
    for (const side of SIDES) {
      const o = npcOrders(s, cardIndex, side);
      expect(checkOrders(s, cardIndex, side, o)).toBeNull();
      orders[side].push(o);
      const sub = submitOrders(s, cardIndex, side, o);
      if (!sub.ok) throw new Error(sub.error);
      const conf = confirmOrders(sub.state, cardIndex, side);
      if (!conf.ok) throw new Error(conf.error);
      s = conf.state;
    }
  }
  return { state: s, orders };
}

describe('npc orders', () => {
  it('is deterministic for the same state', () => {
    const s = game(3);
    expect(npcOrders(s, cardIndex, 'red')).toEqual(npcOrders(s, cardIndex, 'red'));
  });

  it('trains one primary mana novice at the Sanctum on turn 1 and the rest as recruits, and moves', () => {
    const s = game(3);
    const o = npcOrders(s, cardIndex, 'red');
    const primary = houseMana(s.players.red.house)[0];
    expect(o.train.filter((t) => t.as === primary)).toHaveLength(1);
    expect(o.train.some((t) => t.as === 'swordsman' || t.as === 'archer')).toBe(true);
    expect(o.move.length).toBeGreaterThan(0);
    expect(o.discard).toBeNull();
    expect(o.cast.length).toBeLessThanOrEqual(2);
  });

  for (const seed of [1, 2, 3, 4, 5]) {
    it(`plays 25 legal turns against itself (seed ${seed})`, () => {
      const { state, orders } = playTurns(seed, 25);
      expect(state.turn).toBeGreaterThan(1);
      expect(orders.red.some((o) => o.train.length > 0)).toBe(true);
      expect(orders.red.some((o) => o.move.length > 0)).toBe(true);
      expect(orders.red.every((o) => o.discard === null && o.cast.length <= 2)).toBe(true);
    });
  }

  it('casts spells over a game', () => {
    const { orders } = playTurns(2, 12);
    expect([...orders.red, ...orders.blue].some((o) => o.cast.length > 0)).toBe(true);
  });
});

describe('npc mana choice', () => {
  it('weighs what its cards need against what it already makes', () => {
    const s = structuredClone(game(4));
    const red = s.players.red;
    const sanctum = Object.values(s.structures).find((x) => x.kind === 'sanctum' && x.owner === 'red')!;
    const town = Object.values(s.structures).find((x) => x.kind === 'town')!;
    // War cards need strife most and clarity second; with plenty of strife coming in, it picks clarity.
    red.deck = ['volcano', 'volcano'];
    red.hand = [];
    expect(npcPickMana(s, cardIndex, 'red', town.id)).toBe('strife');
    sanctum.manaTrained = { strife: 4 };
    expect(npcPickMana(s, cardIndex, 'red', town.id)).toBe('clarity');
  });

  it('picks the mana its remaining cards use most when it makes none yet, else the house primary', () => {
    const s = game(4);
    const town = Object.values(s.structures).find((x) => x.kind === 'town')!;
    const pick = npcPickMana(s, cardIndex, 'red', town.id);
    const counts: Record<string, number> = {};
    for (const id of [...s.players.red.deck, ...s.players.red.hand]) {
      for (const [m, n] of Object.entries(cardIndex[id].cost)) counts[m] = (counts[m] ?? 0) + (n ?? 0);
    }
    const best = Math.max(...Object.values(counts));
    expect(counts[pick]).toBe(best);

    const empty = structuredClone(s);
    empty.players.red.deck = [];
    empty.players.red.hand = [];
    expect(npcPickMana(empty, cardIndex, 'red', town.id)).toBe(houseMana(s.players.red.house)[0]);
  });

  it('returns empty orders outside the orders phase rather than throwing', () => {
    const s = structuredClone(game(1));
    s.phase = 'over';
    expect(npcOrders(s, cardIndex, 'red')).toEqual(emptyOrders());
  });
});
