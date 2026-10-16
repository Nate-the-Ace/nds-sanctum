import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { makeCtx } from '../src/ctx';
import { killMinion } from '../src/death';
import { dispel, expireSpells } from '../src/spells';
import { addSpellRecord } from '../src/spellstore';
import type { Engine } from '../src/engine';
import type { Ref } from '../src/types';
import { blankEngine, put } from './helpers';

const on = (e: Engine, cardId: string, host: Ref, turnsLeft: number | null = null) =>
  addSpellRecord(e.state, { cardId, owner: 'red', host, visible: true, turnsLeft, tokens: {} });

describe('onDispel', () => {
  const ward = defineCard({
    id: 'ward', name: 'ward', house: 'life', cost: {}, type: 'alteration', target: 'recruit',
    onDispel: (c) => { c.addMana('red', 'world', 1); c.dispel(); },
  });
  it('runs on dispel and on expiry, once, but not when the host dies', () => {
    const e = blankEngine([ward]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman', 'swordsman']);
    const a = on(e, 'ward', { kind: 'minion', id: g.minionIds[0] });
    dispel(e, a.id);
    expect(e.state.players.red.mana.world).toBe(1);
    expect(e.state.spells).toHaveLength(0);
    on(e, 'ward', { kind: 'minion', id: g.minionIds[1] }, 1);
    expireSpells(e);
    expect(e.state.players.red.mana.world).toBe(2);
    on(e, 'ward', { kind: 'minion', id: g.minionIds[2] });
    killMinion(e, g.minionIds[2], null, 'dies');
    expect(e.state.players.red.mana.world).toBe(2);
  });
});

describe('removeGroup', () => {
  const mourner = defineCard({
    id: 'mourner', name: 'mourner', house: 'life', cost: {}, type: 'alteration', target: 'globe',
    on: { 'minion:dies': (c) => c.setToken('deaths', c.token('deaths') + 1) },
  });
  it('removes an off-board group without death events', () => {
    const e = blankEngine([mourner]);
    const sp = on(e, 'mourner', { kind: 'globe' });
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    const ids = [...g.minionIds];
    g.pos = null;
    makeCtx(e, sp).removeGroup(g.id);
    expect(e.state.groups[g.id]).toBeUndefined();
    expect(ids.map((id) => e.state.minions[id].status)).toEqual(['dead', 'dead']);
    expect(sp.tokens.deaths ?? 0).toBe(0);
  });
});

describe('time stops off the board', () => {
  it('durations on an off-board group do not count down', () => {
    const e = blankEngine();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const sp = on(e, 'timer', { kind: 'minion', id: g.minionIds[0] }, 2);
    g.pos = null;
    expireSpells(e);
    expect(sp.turnsLeft).toBe(2);
    g.pos = { x: 4, y: 4 };
    expireSpells(e);
    expect(sp.turnsLeft).toBe(1);
  });
});
