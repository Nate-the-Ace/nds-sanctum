import { describe, it, expect } from 'vitest';
import {
  chooseMana, confirmOrders, createGame, emptyOrders, submitOrders, validateDeck,
  type GameState, type Mana, type Orders, type Result, type Side,
} from '@sanctum/engine';
import { allCards, cardIndex } from '../src/index';

const deck = (house: 'war' | 'life') => {
  const ids = allCards.filter((c) => c.house === house && !c.helper).map((c) => c.id);
  return { house, cards: [...ids, ...ids, ...ids] };
};
const MANA: Record<Side, Mana> = { red: 'strife', blue: 'clarity' };

function ok(r: Result): GameState {
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** Train a mana novice if one is left; try to march the first group; fall back to no move. */
function submit(s: GameState, side: Side): GameState {
  const sanctum = Object.values(s.structures).find((x) => x.kind === 'sanctum' && x.owner === side)!;
  const group = Object.values(s.groups)
    .filter((g) => g.owner === side && g.control === 'player' && g.pos)
    .sort((a, b) => a.id - b.id)[0];
  const train = sanctum.novices > 0 ? [{ structureId: sanctum.id, as: MANA[side] }] : [];
  const dirs = side === 'red' ? (['e', 's'] as const) : (['w', 'n'] as const);
  const attempts: Orders[] = group
    ? dirs.map((dir) => ({ ...emptyOrders(), train, move: [{ groupId: group.id, dir }] }))
    : [];
  attempts.push({ ...emptyOrders(), train });
  for (const o of attempts) {
    const r = submitOrders(s, cardIndex, side, o);
    if (r.ok) return r.state;
  }
  throw new Error(`no legal orders for ${side}`);
}

function play(seed: number, turns: number): GameState {
  let s = createGame({ seed, decks: { red: deck('war'), blue: deck('life') } }, cardIndex);
  for (let t = 0; t < turns && s.phase !== 'over'; t++) {
    for (const side of ['red', 'blue'] as const) {
      s = submit(s, side);
      s = ok(confirmOrders(s, cardIndex, side));
    }
    while (s.phase === 'choose-mana') {
      const id = s.pendingMana[0];
      const owner = s.structures[id].owner as Side;
      s = ok(chooseMana(s, cardIndex, owner, id, MANA[owner]));
    }
  }
  return s;
}

describe('a real game with the implemented cards', () => {
  it('plays eight turns without error', () => {
    const s = play(11, 8);
    expect(s.turn).toBeGreaterThan(5);
    expect(s.players.red.hand.length).toBeGreaterThan(0);
  });

  it('is deterministic per seed', () => {
    expect(JSON.stringify(play(11, 8))).toBe(JSON.stringify(play(11, 8)));
  });

  it('survives a JSON round trip', () => {
    const s = play(5, 6);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it('accepts legal 39-card decks of every implemented card', () => {
    expect(validateDeck(deck('war'), cardIndex)).toBeNull();
    expect(validateDeck(deck('life'), cardIndex)).toBeNull();
  });
});
