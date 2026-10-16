import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { makeCtx } from '../src/ctx';
import { runMovement } from '../src/movement';
import { hostile } from '../src/query';
import { addSpellRecord } from '../src/spellstore';
import { computeStats } from '../src/stats';
import type { Engine } from '../src/engine';
import { blankEngine, put } from './helpers';

const ctxOf = (e: Engine, cardId = 'x') =>
  makeCtx(e, addSpellRecord(e.state, { cardId, owner: 'red', host: { kind: 'globe' }, visible: false, turnsLeft: null, tokens: {} }));

describe('reach: board', () => {
  const banner = defineCard({
    id: 'banner', name: 'banner', house: 'war', cost: {}, type: 'alteration', target: 'recruit', reach: 'board',
    stats: (q, id, sp) => (sp.host.kind === 'minion' && q.minion(id)?.groupId !== q.minion(sp.host.id)?.groupId ? { hand: 1 } : {}),
  });
  it('asks the stats hook about every minion, not while the host is off the board', () => {
    const e = blankEngine([banner]);
    const home = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const other = put(e, 'red', { x: 7, y: 2 }, ['swordsman']);
    addSpellRecord(e.state, { cardId: 'banner', owner: 'red', host: { kind: 'minion', id: home.minionIds[0] }, visible: true, turnsLeft: null, tokens: {} });
    expect(computeStats(e, other.minionIds[0]).hand).toBe(3);
    expect(computeStats(e, home.minionIds[0]).hand).toBe(2);
    home.pos = null;
    expect(computeStats(e, other.minionIds[0]).hand).toBe(2);
  });
});

describe('dualClass', () => {
  it('defaults to false and can be granted', () => {
    const both = defineCard({ id: 'both', name: 'both', house: 'war', cost: {}, type: 'alteration', target: 'recruit', stats: () => ({ dualClass: true }) });
    const e = blankEngine([both]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    addSpellRecord(e.state, { cardId: 'both', owner: 'red', host: { kind: 'minion', id: g.minionIds[0] }, visible: true, turnsLeft: null, tokens: {} });
    expect(computeStats(e, g.minionIds[0]).dualClass).toBe(true);
    expect(computeStats(e, g.minionIds[1]).dualClass).toBe(false);
  });
});

describe('setOwner and setControl', () => {
  it('gives a group to the neutral player', () => {
    const e = blankEngine();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    const friend = put(e, 'red', { x: 6, y: 6 }, ['swordsman']);
    const sp = addSpellRecord(e.state, { cardId: 'y', owner: 'red', host: { kind: 'group', id: g.id }, visible: true, turnsLeft: null, tokens: {} });
    ctxOf(e).setOwner(g.id, 'neutral');
    expect(g.owner).toBe('neutral');
    expect(g.minionIds.map((id) => e.state.minions[id].owner)).toEqual(['neutral', 'neutral']);
    expect(e.state.groupSeq.red).not.toContain(g.id);
    expect(e.state.groupSeq.neutral).toContain(g.id);
    expect(sp.owner).toBe('red');
    expect(hostile(g, friend)).toBe(true);
  });

  it('switches control and bot', () => {
    const mover = defineCard({ id: 'mover', name: 'mover', house: 'war', cost: {}, type: 'manifestation', target: 'recruitGroup', bot: () => 'e' });
    const e = blankEngine([mover]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    g.moveOrder = 's';
    ctxOf(e, 'mover').setControl(g.id, 'computer');
    expect(g).toMatchObject({ control: 'computer', botId: 'mover', moveOrder: null });
    runMovement(e);
    expect(g.pos).toEqual({ x: 5, y: 4 });
    ctxOf(e, 'mover').setControl(g.id, 'player');
    expect(g).toMatchObject({ control: 'player', botId: null });
  });
});
