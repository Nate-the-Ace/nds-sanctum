import { parseKey } from './board';
import type { CardIndex } from './cards';
import { makeEngine } from './engine';
import { validateOrders } from './orders';
import { castCheck } from './spells';
import { computeStats, type Stats } from './stats';
import type { GameState, Orders, Ref, Side } from './types';

/*
 * Read-only views for clients. Each call works on a private copy of the state (`makeEngine` clones it), so the
 * state a client holds is never touched.
 */

/** A minion's stats right now: base values plus every spell and aura that reaches it. */
export function viewStats(state: GameState, cards: CardIndex, minionId: number): Stats {
  return computeStats(makeEngine(state, cards), minionId);
}

/** Every target `cardId` could legally be cast on by `side` right now (type, concealment, occupancy, its own rules). */
export function legalTargets(state: GameState, cards: CardIndex, side: Side, cardId: string): Ref[] {
  const card = cards[cardId];
  if (!card) return [];
  const e = makeEngine(state, cards);
  const out: Ref[] = [];
  const consider = (r: Ref) => {
    if (castCheck(e, side, card, r)) out.push(r);
  };
  const ids = (m: Record<number, unknown>) => Object.keys(m).map(Number);
  switch (card.target) {
    case 'globe':
      consider({ kind: 'globe' });
      break;
    case 'square':
      for (const k of state.cells) consider({ kind: 'square', pos: parseKey(k) });
      break;
    case 'structure':
      for (const id of ids(state.structures)) consider({ kind: 'structure', id });
      break;
    case 'recruit':
    case 'monster':
    case 'minion':
      for (const id of ids(state.minions)) consider({ kind: 'minion', id });
      break;
    default:
      for (const id of ids(state.groups)) consider({ kind: 'group', id });
  }
  return out;
}

/** The engine's verdict on a draft of orders: its error message, or null when the orders are legal. */
export function checkOrders(state: GameState, cards: CardIndex, side: Side, orders: Orders): string | null {
  return validateOrders(makeEngine(state, cards), side, orders);
}
