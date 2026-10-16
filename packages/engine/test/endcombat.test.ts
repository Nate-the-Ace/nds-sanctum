import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { fight, runCombats } from '../src/combat';
import { addSpellRecord } from '../src/spellstore';
import { blankEngine, put } from './helpers';

const round3 = defineCard({
  id: 'round3', name: 'Round3', house: 'war', cost: {}, type: 'alteration', target: 'globe',
  on: { 'round:start': (c, ev) => { if (ev.data.round === 3) c.endCombat(); } },
});
const startEnd = defineCard({
  id: 'startend', name: 'StartEnd', house: 'war', cost: {}, type: 'alteration', target: 'globe',
  on: { 'combat:start': (c) => c.endCombat() },
});
const peace = defineCard({
  id: 'peace', name: 'Peace', house: 'war', cost: {}, type: 'alteration', target: 'globe',
  on: { 'combat:before': (c) => c.cancel() },
});
const watch = defineCard({
  id: 'watch', name: 'Watch', house: 'war', cost: {}, type: 'alteration', target: 'globe', exclusive: false,
  on: {
    'combat:end': (c) => c.setToken('end', 1),
    'combat:after': (c) => c.setToken('after', 1),
    'turn:afterCombat': (c) => c.setToken('afterAll', 1),
  },
});
const all = [round3, startEnd, peace, watch];
const on = (e: ReturnType<typeof blankEngine>, cardId: string) =>
  addSpellRecord(e.state, { cardId, owner: 'red', host: { kind: 'globe' }, visible: true, turnsLeft: null, tokens: {} });

describe('ending a combat early', () => {
  it('stops at the start of round 3: two archer rounds were fought', () => {
    const e = blankEngine(all);
    on(e, 'round3');
    const a = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    const b = put(e, 'blue', { x: 5, y: 4 }, ['archer']);
    const [ida, idb] = [a.minionIds[0], b.minionIds[0]];
    fight(e, a.id, b.id);
    expect(e.state.minions[ida].hp).toBe(4);
    expect(e.state.minions[idb].hp).toBe(4);
  });

  it('can end the combat before round 1 and still fires combat:end and combat:after', () => {
    const e = blankEngine(all);
    on(e, 'startend');
    const w = on(e, 'watch');
    const a = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const b = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']);
    const [ida, idb] = [a.minionIds[0], b.minionIds[0]];
    fight(e, a.id, b.id);
    expect(e.state.minions[ida].hp).toBe(7);
    expect(e.state.minions[idb].hp).toBe(7);
    expect(w.tokens).toMatchObject({ end: 1, after: 1 });
  });
});

describe('cancelling the combat phase', () => {
  it('skips every combat but still fires turn:afterCombat', () => {
    const e = blankEngine(all);
    on(e, 'peace');
    const w = on(e, 'watch');
    const a = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const b = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']);
    const [ida, idb] = [a.minionIds[0], b.minionIds[0]];
    runCombats(e);
    expect(e.state.minions[ida].hp).toBe(7);
    expect(e.state.minions[idb].hp).toBe(7);
    expect(w.tokens.afterAll).toBe(1);
    expect(w.tokens.end).toBeUndefined();
  });
});
