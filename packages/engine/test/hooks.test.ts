import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { fight } from '../src/combat';
import { dispatch } from '../src/events';
import { executeCast } from '../src/spells';
import { computeStats } from '../src/stats';
import { beginTurn } from '../src/turn';
import { addSpellRecord } from '../src/spellstore';
import { createGroup, spawnMinion } from '../src/units';
import type { MinionSpec } from '../src/types';
import { blankEngine, put } from './helpers';

const host = (e: ReturnType<typeof blankEngine>, cardId: string, minionId: number, owner: 'red' | 'blue' = 'red') =>
  addSpellRecord(e.state, { cardId, owner, host: { kind: 'minion', id: minionId }, visible: false, turnsLeft: null, tokens: {} });
const dummy = (extra: Partial<MinionSpec['base']> = {}): MinionSpec => ({
  kind: 'monster', cls: 'monster', name: 'dummy',
  base: { hp: 100, level: 1, armor: 0, hand: 0, handAttacks: 0, missile: 0, missileAttacks: 0, walks: [], ...extra },
});

describe('groupAura', () => {
  it('applies a minion-hosted spell to its whole group', () => {
    const aura = defineCard({
      id: 'aura', name: 'aura', house: 'war', cost: {}, type: 'alteration', target: 'recruit', groupAura: true,
      stats: (q, id, sp) => (sp.host.kind === 'minion' && sp.host.id === id ? {} : { hand: 1 }),
    });
    const e = blankEngine([aura]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman']);
    const other = put(e, 'red', { x: 6, y: 6 }, ['swordsman']);
    host(e, 'aura', g.minionIds[0]);
    expect(computeStats(e, g.minionIds[0]).hand).toBe(2);
    expect(computeStats(e, g.minionIds[1]).hand).toBe(3);
    expect(computeStats(e, other.minionIds[0]).hand).toBe(2);
  });
});

describe('attacker:strikes', () => {
  it('lets a handler change the damage of an attack', () => {
    const boost = defineCard({
      id: 'boost', name: 'boost', house: 'war', cost: {}, type: 'alteration', target: 'recruit',
      on: { 'attacker:strikes': (_c, ev) => { ev.data.damage += 5; } },
    });
    const e = blankEngine([boost]);
    const a = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    host(e, 'boost', a.minionIds[0]);
    const b = createGroup(e, 'blue', { x: 5, y: 4 }, 'monster', 'computer');
    const v = spawnMinion(e, b.id, dummy());
    fight(e, a.id, b.id);
    expect(e.state.minions[v.id].hp).toBe(100 - 9 * 7); // 9 attacks of 2 + 5
  });
});

describe('taunt', () => {
  it('makes shooters pick the taunting minion', () => {
    const decoy = defineCard({ id: 'decoy', name: 'decoy', house: 'war', cost: {}, type: 'alteration', target: 'recruit', stats: () => ({ taunt: true }) });
    const probe = defineCard({
      id: 'probe', name: 'probe', house: 'war', cost: {}, type: 'alteration', target: 'recruit',
      on: { 'attacker:strikes': (c, ev) => { c.setToken('victim', ev.data.victimId); } },
    });
    const e = blankEngine([decoy, probe]);
    const shooter = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    const sp = host(e, 'probe', shooter.minionIds[0]);
    const foes = put(e, 'blue', { x: 5, y: 4 }, ['swordsman', 'swordsman']);
    host(e, 'decoy', foes.minionIds[1], 'blue');
    fight(e, shooter.id, foes.id);
    expect(sp.tokens.victim).toBe(foes.minionIds[1]);
  });
});

describe('initiative:decide', () => {
  it('lets a spell set the initiative after the structure deltas', () => {
    const lien = defineCard({
      id: 'lien', name: 'lien', house: 'life', cost: {}, type: 'alteration', target: 'globe', visible: false,
      on: { 'initiative:decide': (c) => { if (c.spell.owner !== 'neutral') c.setInitiative(c.spell.owner); } },
    });
    const e = blankEngine([lien]);
    addSpellRecord(e.state, { cardId: 'lien', owner: 'blue', host: { kind: 'globe' }, visible: false, turnsLeft: null, tokens: {} });
    expect(e.state.initiative).toBe('red');
    beginTurn(e, false);
    expect(e.state.initiative).toBe('blue');
  });
});

describe('hero once per game', () => {
  it('squanders a second cast of the same hero', () => {
    const hero = defineCard({ id: 'hero1', name: 'Hero', house: 'war', cost: {}, type: 'hero', target: 'globe' });
    const e = blankEngine([hero]);
    expect(executeCast(e, 'red', 'hero1', { kind: 'globe' })).toBe('cast');
    expect(e.state.players.red.heroesCast).toEqual(['hero1']);
    expect(executeCast(e, 'red', 'hero1', { kind: 'globe' })).toBe('squandered');
    expect(executeCast(e, 'blue', 'hero1', { kind: 'globe' })).toBe('cast');
  });
});

describe('off-board groups', () => {
  it('receive no events', () => {
    const tick = defineCard({
      id: 'tick', name: 'tick', house: 'war', cost: {}, type: 'alteration', target: 'recruit', visible: false,
      on: { 'turn:start': (c) => c.setToken('n', c.token('n') + 1) },
    });
    const e = blankEngine([tick]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const sp = host(e, 'tick', g.minionIds[0]);
    dispatch(e, 'turn:start');
    expect(sp.tokens.n).toBe(1);
    e.state.groups[g.id].pos = null;
    dispatch(e, 'turn:start');
    expect(sp.tokens.n).toBe(1);
  });
});
