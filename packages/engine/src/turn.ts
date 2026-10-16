import { drawCards } from './deck';
import type { Engine } from './engine';
import { dispatch } from './events';
import { groupAt } from './query';
import { RULES } from './rules';
import { applyTerrain } from './terrainfx';
import { emptyPool, SIDES } from './types';
import type { Side } from './types';

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
  s.phase = 'orders';
}
