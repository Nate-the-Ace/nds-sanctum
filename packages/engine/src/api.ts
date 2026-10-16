import { SANCTUM_POS } from './board';
import type { CardIndex } from './cards';
import { makeEngine } from './engine';
import { placeTowns, rollTerrain } from './mapgen';
import { validateOrders } from './orders';
import { shuffle } from './rng';
import { RULES } from './rules';
import { blankState } from './state';
import { beginTurn, finishTurnStart, resolveTurn } from './turn';
import { addRecruit } from './units';
import { SIDES, emptyOrders } from './types';
import type { GameState, HouseId, Mana, Orders, Side, TerrainId } from './types';

export interface DeckConfig {
  house: HouseId;
  cards: string[];
}

export interface GameConfig {
  seed: number;
  decks: Record<Side, DeckConfig>;
  options?: { towns?: number; flatTerrain?: boolean; skipDeckRules?: boolean };
}

/** Returns an error message, or null if the deck is legal. */
export function validateDeck(deck: DeckConfig, cards: CardIndex, limits: { minDeck?: number } = {}): string | null {
  const min = limits.minDeck ?? RULES.minDeck;
  if (deck.cards.length < min) return `needs at least ${min} cards`;
  const counts: Record<string, number> = {};
  for (const id of deck.cards) {
    if (!cards[id]) return `unknown card "${id}"`;
    if (cards[id].helper) return `"${id}" is a helper spell, not a playable card`;
    counts[id] = (counts[id] ?? 0) + 1;
    if (counts[id] > RULES.maxCopies) return `more than ${RULES.maxCopies} copies of "${id}"`;
  }
  return null;
}

export function createGame(config: GameConfig, cards: CardIndex): GameState {
  const opts = config.options ?? {};
  for (const side of SIDES) {
    const deck = config.decks[side];
    if (opts.skipDeckRules) {
      for (const id of deck.cards) if (!cards[id]) throw new Error(`${side} deck: unknown card "${id}"`);
    } else {
      const err = validateDeck(deck, cards);
      if (err) throw new Error(`${side} deck: ${err}`);
    }
  }
  const e = makeEngine(blankState(config.seed, { red: config.decks.red.house, blue: config.decks.blue.house }), cards);
  const s = e.state;
  const towns = placeTowns(s, opts.towns ?? RULES.towns);
  if (opts.flatTerrain) {
    const flat: Record<string, TerrainId> = {};
    for (const k of s.cells) flat[k] = 'plains';
    s.terrain = flat;
  } else {
    s.terrain = rollTerrain(s, s.cells, towns);
  }
  for (const side of SIDES) {
    s.structures[s.nextId] = {
      id: s.nextId++, kind: 'sanctum', pos: { ...SANCTUM_POS[side] }, owner: side, manaType: null,
      novices: RULES.startNovices, turnCount: RULES.sanctumNoviceRate, captured: false,
    };
    s.players[side].deck = shuffle(s, config.decks[side].cards);
  }
  for (const pos of towns) {
    s.structures[s.nextId] = {
      id: s.nextId++, kind: 'town', pos: { ...pos }, owner: 'neutral', manaType: null,
      novices: 0, turnCount: RULES.townNoviceRate, captured: false,
    };
  }
  for (const side of SIDES) {
    for (const cls of RULES.startGroup) addRecruit(e, side, SANCTUM_POS[side], cls);
  }
  beginTurn(e, true);
  return e.state;
}

export type Result = { ok: true; state: GameState } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

/** The owner of a freshly captured town picks the mana type it produces (any of the 6, fixed until lost). */
export function chooseMana(state: GameState, cards: CardIndex, side: Side, structureId: number, mana: Mana): Result {
  const e = makeEngine(state, cards);
  const s = e.state;
  if (s.phase !== 'choose-mana') return fail('not choosing mana');
  const st = s.structures[structureId];
  if (!st || !s.pendingMana.includes(structureId)) return fail('that structure is not awaiting a mana choice');
  if (st.owner !== side) return fail('not your structure');
  st.manaType = mana;
  s.pendingMana = s.pendingMana.filter((id) => id !== structureId);
  if (s.pendingMana.length === 0) finishTurnStart(e);
  return { ok: true, state: e.state };
}

/** Validate and store a player's orders for this turn, replacing any earlier submission. */
export function submitOrders(state: GameState, cards: CardIndex, side: Side, orders: Orders): Result {
  const e = makeEngine(state, cards);
  const err = validateOrders(e, side, orders);
  if (err) return fail(err);
  e.state.players[side].orders = structuredClone(orders);
  return { ok: true, state: e.state };
}

/** Lock a player's orders. When both players have confirmed, the turn resolves and the next one begins. */
export function confirmOrders(state: GameState, cards: CardIndex, side: Side): Result {
  const e = makeEngine(state, cards);
  const s = e.state;
  if (s.phase !== 'orders') return fail('not in the orders phase');
  const p = s.players[side];
  if (p.confirmed) return fail('already confirmed');
  if (!p.orders) p.orders = emptyOrders();
  p.confirmed = true;
  if (SIDES.every((x) => s.players[x].confirmed)) resolveTurn(e);
  return { ok: true, state: e.state };
}
