import { describe, it, expect } from 'vitest';
import { chooseMana } from '../src/api';
import { defineCard } from '../src/cards';
import { SANCTUM_POS } from '../src/board';
import { makeCtx } from '../src/ctx';
import { beginTurn } from '../src/turn';
import { removeGroup } from '../src/units';
import type { ActiveSpell } from '../src/types';
import { gameEngine, put } from './helpers';

const dummy = defineCard({ id: 'dummy', name: 'Dummy', house: 'war', cost: { strife: 1 }, type: 'manifestation', target: 'globe' });

function advance(e: ReturnType<typeof gameEngine>) {
  e.state.turn += 1;
  beginTurn(e, false);
}

describe('start of turn', () => {
  it('starts turn 1 in the orders phase with full hands', () => {
    const e = gameEngine([dummy], Array(10).fill('dummy'));
    expect(e.state.phase).toBe('orders');
    expect(e.state.turn).toBe(1);
    expect(e.state.players.red.hand).toHaveLength(5);
    expect(e.state.players.red.deck).toHaveLength(5);
  });

  it('produces a Sanctum novice every fourth turn', () => {
    const e = gameEngine();
    const sanctum = Object.values(e.state.structures).find((s) => s.owner === 'red')!;
    expect(sanctum.novices).toBe(3);
    advance(e); advance(e); advance(e);
    expect(sanctum.novices).toBe(3);
    advance(e);
    expect(sanctum.novices).toBe(4);
    expect(sanctum.turnCount).toBe(4);
  });

  it('captures a neutral town, flips initiative, and waits for the mana choice', () => {
    const e = gameEngine([], [], { towns: 1 });
    const town = Object.values(e.state.structures).find((s) => s.kind === 'town')!;
    put(e, 'red', town.pos, ['swordsman']);
    e.state.initiative = 'blue';
    advance(e);
    expect(town.owner).toBe('red');
    expect(e.state.phase).toBe('choose-mana');
    expect(e.state.pendingMana).toEqual([town.id]);
    expect(e.state.initiative).toBe('red');
    const r = chooseMana(e.state, e.cards, 'red', town.id, 'strife');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.phase).toBe('orders');
    expect(r.state.structures[town.id].manaType).toBe('strife');
    expect(r.state.players.red.mana.strife).toBe(1);
  });

  it('rejects a mana choice from the wrong player or at the wrong time', () => {
    const e = gameEngine([], [], { towns: 1 });
    const town = Object.values(e.state.structures).find((s) => s.kind === 'town')!;
    expect(chooseMana(e.state, e.cards, 'red', town.id, 'strife').ok).toBe(false);
    put(e, 'red', town.pos, ['swordsman']);
    advance(e);
    expect(chooseMana(e.state, e.cards, 'blue', town.id, 'strife').ok).toBe(false);
  });

  it('keeps initiative on a tie', () => {
    const e = gameEngine();
    e.state.initiative = 'blue';
    advance(e);
    expect(e.state.initiative).toBe('blue');
  });

  it('ends the game when a hostile recruit group stands in a Sanctum', () => {
    const e = gameEngine();
    for (const g of Object.values(e.state.groups)) if (g.owner === 'red') removeGroup(e, g.id);
    put(e, 'blue', SANCTUM_POS.red, ['swordsman']);
    advance(e);
    expect(e.state.winner).toBe('blue');
    expect(e.state.phase).toBe('over');
  });

  it('desert damages after start of turn unless the group has desertwalk', () => {
    const e = gameEngine();
    e.state.terrain['4,4'] = 'desert';
    e.state.terrain['5,5'] = 'desert';
    const a = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const b = put(e, 'red', { x: 5, y: 5 }, ['swordsman']);
    e.state.minions[b.minionIds[0]].base.walks.push('desert');
    advance(e);
    expect(e.state.minions[a.minionIds[0]].hp).toBe(6);
    expect(e.state.minions[b.minionIds[0]].hp).toBe(7);
  });

  it('drowns minions standing in water without waterwalk', () => {
    const e = gameEngine();
    e.state.terrain['4,4'] = 'water';
    const a = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const mid = a.minionIds[0];
    advance(e);
    expect(e.state.minions[mid].status).toBe('dead');
    expect(e.state.groups[a.id]).toBeUndefined();
  });

  it('awards the experience level once', () => {
    const e = gameEngine();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const m = e.state.minions[g.minionIds[0]];
    m.expQualified = true;
    advance(e);
    expect(m.base.level).toBe(2);
    expect(m.hasExp).toBe(true);
    advance(e);
    expect(m.base.level).toBe(2);
  });
});

describe('ctx.setTerrain', () => {
  it('changes terrain, applies fatal terrain immediately, and refuses structures', () => {
    const e = gameEngine();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const spell: ActiveSpell = { id: -1, cardId: 'x', owner: 'red', host: { kind: 'globe' }, visible: false, turnsLeft: null, tokens: {} };
    const ctx = makeCtx(e, spell);
    ctx.setTerrain({ x: 5, y: 5 }, 'forest');
    expect(e.state.terrain['5,5']).toBe('forest');
    ctx.setTerrain({ x: 2, y: 2 }, 'water');
    expect(e.state.terrain['2,2']).toBe('plains');
    const mid = g.minionIds[0];
    ctx.setTerrain({ x: 4, y: 4 }, 'water');
    expect(e.state.minions[mid].status).toBe('dead');
  });
});
