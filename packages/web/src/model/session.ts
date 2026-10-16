import { cardIndex, starterDeck } from '@sanctum/cards';
import {
  chooseMana, checkOrders, confirmOrders, createGame, emptyOrders, submitOrders,
  type CardIndex, type GameState, type HouseId, type Mana, type Orders, type Side,
} from '@sanctum/engine';
import { turnReport, type Report } from './report';

export type Screen =
  | { kind: 'handoff'; to: Side }
  | { kind: 'orders'; side: Side }
  | { kind: 'mana'; side: Side }
  | { kind: 'report' }
  | { kind: 'over' };

export interface Session {
  cards: CardIndex;
  state: GameState;
  screen: Screen;
  report: Report | null;
}

export type LockResult = { ok: true; session: Session } | { ok: false; error: string };

/** Where the game goes next: over, a mana choice for a captured structure, or the next hand-off to red. */
function route(cards: CardIndex, state: GameState, report: Report | null): Session {
  if (state.phase === 'over') return { cards, state, screen: { kind: 'over' }, report };
  if (state.phase === 'choose-mana') {
    const st = state.structures[state.pendingMana[0]];
    return { cards, state, screen: { kind: 'mana', side: st.owner as Side }, report };
  }
  return { cards, state, screen: { kind: 'handoff', to: 'red' }, report };
}

export function newSession(seed: number, houses: Record<Side, HouseId>, cards: CardIndex = cardIndex): Session {
  const decks = { red: starterDeck(houses.red as 'war' | 'life'), blue: starterDeck(houses.blue as 'war' | 'life') };
  return route(cards, createGame({ seed, decks }, cards), null);
}

/** The next player is ready (the device has been handed over): show their orders screen. */
export function begin(s: Session, side: Side): Session {
  return { ...s, screen: { kind: 'orders', side } };
}

/**
 * Lock a player's orders. Red's go to a hand-off to blue; blue's lock resolves the turn and produces a report.
 * Invalid orders return the engine's message and change nothing.
 */
export function lock(s: Session, side: Side, orders: Orders): LockResult {
  const err = checkOrders(s.state, s.cards, side, orders);
  if (err) return { ok: false, error: err };
  const sub = submitOrders(s.state, s.cards, side, orders);
  if (!sub.ok) return { ok: false, error: sub.error };
  const conf = confirmOrders(sub.state, s.cards, side);
  if (!conf.ok) return { ok: false, error: conf.error };
  if (side === 'red') return { ok: true, session: { ...s, state: conf.state, screen: { kind: 'handoff', to: 'blue' } } };
  const report = turnReport(sub.state, conf.state, s.cards);
  return { ok: true, session: { ...s, state: conf.state, report, screen: { kind: 'report' } } };
}

/** The report has been read: go on to a mana choice, the end screen, or the next turn. */
export function afterReport(s: Session): Session {
  return route(s.cards, s.state, s.report);
}

/** A captured structure's owner picks its mana type. */
export function pickMana(s: Session, side: Side, structureId: number, mana: Mana): Session {
  const r = chooseMana(s.state, s.cards, side, structureId, mana);
  if (!r.ok) throw new Error(r.error);
  return route(s.cards, r.state, s.report);
}

export { emptyOrders };
