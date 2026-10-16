import { runCombats } from './combat';
import { drawCards } from './deck';
import type { Engine } from './engine';
import { dispatch } from './events';
import { runMovement } from './movement';
import { groupAt, otherSide } from './query';
import { RULES } from './rules';
import { executeCast, expireSpells } from './spells';
import { applyTerrain } from './terrainfx';
import { addRecruit } from './units';
import { emptyOrders, emptyPool, SIDES } from './types';
import type { Orders, Ref, Side } from './types';

/**
 * Start-of-turn phase (rules: Pipelines/turnphases, phase 1), up to the mana choice.
 * Sets phase to 'choose-mana' if a capture needs a choice, else finishes the turn start.
 */
export function beginTurn(e: Engine, first: boolean): void {
  const s = e.state;
  s.log.push({ type: 'turn', turn: s.turn });
  for (const m of Object.values(s.minions)) {
    if (m.status === 'alive' && m.expQualified && !m.hasExp) {
      m.hasExp = true;
      m.base.level = Math.min(RULES.maxLevel, m.base.level + 1);
    }
  }
  dispatch(e, 'turn:start');
  dispatch(e, 'turn:startAfter');
  applyTerrain(e, 'afterStart');
  for (const side of SIDES) drawCards(e, side, Math.max(0, RULES.handSize - s.players[side].hand.length));

  const delta = { red: 0, blue: 0 };
  s.pendingMana = [];
  for (const st of Object.values(s.structures)) {
    const g = groupAt(s, st.pos);
    const captor = g && g.kind === 'recruit' && g.owner !== 'neutral' && g.owner !== st.owner ? g.owner : null;
    if (!captor) continue;
    if (st.kind === 'sanctum') {
      s.winner = captor;
      s.phase = 'over';
      s.log.push({ type: 'win', winner: captor });
      return;
    }
    if (st.owner !== 'neutral') delta[st.owner]--;
    delta[captor]++;
    st.owner = captor;
    st.novices = 0;
    st.turnCount = RULES.townNoviceRate;
    st.manaType = null;
    st.captured = true;
    s.pendingMana.push(st.id);
    s.log.push({ type: 'capture', structure: st.id, by: captor });
  }

  if (!first) {
    for (const st of Object.values(s.structures)) {
      if (st.owner === 'neutral' || st.captured) continue;
      st.turnCount = Math.max(0, st.turnCount - 1);
      if (st.turnCount === 0 && st.novices < RULES.maxNovices) {
        st.novices++;
        st.turnCount = st.kind === 'sanctum' ? RULES.sanctumNoviceRate : RULES.townNoviceRate;
      }
    }
  }
  for (const st of Object.values(s.structures)) st.captured = false;

  if (delta.red !== delta.blue) s.initiative = delta.red > delta.blue ? 'red' : 'blue';
  if (s.pendingMana.length > 0) {
    s.phase = 'choose-mana';
    return;
  }
  finishTurnStart(e);
}

/** Generate mana and open the orders phase. Called when no mana choice is pending. */
export function finishTurnStart(e: Engine): void {
  const s = e.state;
  for (const side of SIDES) {
    const p = s.players[side];
    p.mana = emptyPool();
    p.orders = null;
    p.confirmed = false;
  }
  for (const st of Object.values(s.structures)) {
    if (st.kind !== 'sanctum' && st.owner !== 'neutral' && st.manaType) {
      s.players[st.owner as Side].mana[st.manaType]++;
    }
  }
  dispatch(e, 'mana:generate');
  s.phase = 'orders';
}

function applyTraining(e: Engine, side: Side, o: Orders): void {
  const s = e.state;
  for (const t of o.train) {
    const st = s.structures[t.structureId];
    if (!st || st.owner !== side || st.novices <= 0) continue;
    st.novices--;
    if (t.as === 'swordsman' || t.as === 'archer') addRecruit(e, side, st.pos, t.as);
  }
}

/** Deletes the dead, then expires finite-duration spells. */
function collectGarbage(e: Engine): void {
  const s = e.state;
  for (const id of s.graveyard) delete s.minions[id];
  s.graveyard = [];
  expireSpells(e);
}

/**
 * Phases 3-6 of the turn, then the next start of turn.
 * Training, hand bookkeeping, spells (initiative first), movement, combat, garbage collection.
 */
export function resolveTurn(e: Engine): void {
  const s = e.state;
  s.log = [];
  const order: Side[] = [s.initiative, otherSide(s.initiative)];
  const orders = { red: s.players.red.orders ?? emptyOrders(), blue: s.players.blue.orders ?? emptyOrders() };

  const casts = {} as Record<Side, Array<{ cardId: string; target: Ref }>>;
  for (const side of SIDES) {
    const hand = s.players[side].hand;
    casts[side] = orders[side].cast.map((c) => ({ cardId: hand[c.handIndex], target: c.target }));
  }

  for (const side of order) applyTraining(e, side, orders[side]);

  for (const side of SIDES) {
    const p = s.players[side];
    const gone = new Set<number>(orders[side].cast.map((c) => c.handIndex));
    if (orders[side].discard !== null) gone.add(orders[side].discard as number);
    p.discard.push(...[...gone].sort((a, b) => a - b).map((i) => p.hand[i]));
    p.hand = p.hand.filter((_, i) => !gone.has(i));
  }

  // Movement orders are set before spells run so targeted spells can overwrite them immediately.
  for (const g of Object.values(s.groups)) {
    g.moveOrder = null;
    g.moveSeq = null;
  }
  for (const side of SIDES) {
    orders[side].move.forEach((mo, i) => {
      const g = s.groups[mo.groupId];
      if (g && g.pos && g.owner === side && g.control === 'player') {
        g.moveOrder = mo.dir;
        g.moveSeq = i;
      }
    });
  }

  for (const side of order) for (const c of casts[side]) executeCast(e, side, c.cardId, c.target);

  applyTerrain(e, 'beforeMovement');
  runMovement(e);
  applyTerrain(e, 'beforeCombat');
  runCombats(e);
  collectGarbage(e);

  s.turn++;
  beginTurn(e, false);
}
