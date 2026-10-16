import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { confirmOrders } from '../src/api';
import { addSpellRecord, removeSpellsOn } from '../src/spellstore';
import { dispel, executeCast } from '../src/spells';
import { spellsOn } from '../src/query';
import { computeStats } from '../src/stats';
import { blankEngine, gameEngine, put } from './helpers';

const buff = defineCard({
  id: 'buff', name: 'Buff', house: 'war', cost: {}, type: 'alteration', target: 'recruit',
  stats: () => ({ maxHp: 4 }),
  onCast: (c, t) => { if (t.kind === 'minion') c.heal(t.id, 4); },
});
const mend = defineCard({
  id: 'mend', name: 'Mend', house: 'war', cost: {}, type: 'manifestation', target: 'recruit',
  onCast: (c, t) => { if (t.kind === 'minion') c.heal(t.id, 100); },
});
const crush = defineCard({
  id: 'crush', name: 'Crush', house: 'war', cost: {}, type: 'alteration', target: 'recruit',
  stats: () => ({ maxHp: -99 }),
});

describe('maxHp stat', () => {
  it('adds to max and current hp on cast', () => {
    const e = blankEngine([buff]);
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    executeCast(e, 'red', 'buff', { kind: 'minion', id });
    expect(computeStats(e, id).maxHp).toBe(11);
    expect(e.state.minions[id].maxHp).toBe(11);
    expect(e.state.minions[id].hp).toBe(11);
  });

  it('clamps current hp when the spell is dispelled', () => {
    const e = blankEngine([buff]);
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    executeCast(e, 'red', 'buff', { kind: 'minion', id });
    dispel(e, spellsOn(e.state, { kind: 'minion', id })[0].id);
    expect(e.state.minions[id].maxHp).toBe(7);
    expect(e.state.minions[id].hp).toBe(7);
  });

  it('heal stops at the computed max', () => {
    const e = blankEngine([buff, mend]);
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    executeCast(e, 'red', 'buff', { kind: 'minion', id });
    e.state.minions[id].hp = 3;
    executeCast(e, 'red', 'mend', { kind: 'minion', id });
    expect(e.state.minions[id].hp).toBe(11);
  });

  it('never drops below 1', () => {
    const e = blankEngine([crush]);
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    executeCast(e, 'red', 'crush', { kind: 'minion', id });
    expect(computeStats(e, id).maxHp).toBe(1);
    expect(e.state.minions[id].hp).toBe(1);
  });
});

const groupBuff = defineCard({
  id: 'group-buff', name: 'GroupBuff', house: 'war', cost: {}, type: 'alteration', target: 'recruitGroup', helper: true,
  stats: () => ({ maxHp: 4 }),
});

describe('maxHp refresh at end of turn', () => {
  it('re-syncs cached max hp after a spell was removed without dispel', () => {
    const e = gameEngine([groupBuff]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const id = g.minionIds[0];
    const ref = { kind: 'group' as const, id: g.id };
    addSpellRecord(e.state, { cardId: 'group-buff', owner: 'red', host: ref, visible: true, turnsLeft: null, tokens: {} });
    e.state.minions[id].maxHp = 11;
    e.state.minions[id].hp = 11;
    removeSpellsOn(e.state, ref);
    let r = confirmOrders(e.state, e.cards, 'red');
    if (!r.ok) throw new Error(r.error);
    r = confirmOrders(r.state, e.cards, 'blue');
    if (!r.ok) throw new Error(r.error);
    const m = r.state.minions[id];
    expect(m.maxHp).toBe(7);
    expect(m.hp).toBeLessThanOrEqual(m.maxHp);
  });
});
