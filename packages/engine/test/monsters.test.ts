import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import type { EventContext } from '../src/ctx';
import { runMovement } from '../src/movement';
import { executeCast } from '../src/spells';
import { addSpellRecord } from '../src/spellstore';
import { createGroup, spawnMinion } from '../src/units';
import type { MinionSpec } from '../src/types';
import { blankEngine, put } from './helpers';

const spec = (): MinionSpec => ({
  kind: 'monster', cls: 'monster', name: 'beast',
  base: { hp: 9, level: 1, armor: 0, hand: 2, handAttacks: 1, missile: 0, missileAttacks: 0, walks: [] },
});
const globe = { kind: 'globe' as const };

describe('home square', () => {
  it('is set for monster groups only', () => {
    const e = blankEngine();
    expect(createGroup(e, 'red', { x: 3, y: 3 }, 'monster', 'computer').home).toEqual({ x: 3, y: 3 });
    expect(createGroup(e, 'red', { x: 4, y: 4 }, 'recruit', 'player').home).toBeNull();
    expect(createGroup(e, 'red', null, 'monster', 'computer').pos).toBeNull();
  });
});

describe('bot context', () => {
  it('gives bots random() and legalDirections()', () => {
    const walker = defineCard({
      id: 'walker', name: 'walker', house: 'war', cost: {}, type: 'summoning', target: 'square',
      bot: (q, gid) => (q.random() < 2 && q.legalDirections(gid).includes('e') ? 'e' : null),
    });
    const e = blankEngine([walker]);
    const g = createGroup(e, 'red', { x: 3, y: 3 }, 'monster', 'computer', 'walker');
    spawnMinion(e, g.id, spec());
    const hidden = createGroup(e, 'red', null, 'monster', 'computer', 'walker');
    spawnMinion(e, hidden.id, spec());
    runMovement(e);
    expect(g.pos).toEqual({ x: 4, y: 3 });
    expect(hidden.pos).toBeNull();
  });
});

describe('hide, appear and setHome', () => {
  const probe = (fn: (c: EventContext, gid: number) => void) =>
    defineCard({
      id: 'probe', name: 'probe', house: 'war', cost: {}, type: 'manifestation', target: 'globe',
      onCast: (c) => fn(c, Object.keys(c.state.groups).map(Number)[0]),
    });

  it('hide takes a group off the board and appear brings it back without movement events', () => {
    const appeared: boolean[] = [];
    const watch = defineCard({
      id: 'watch', name: 'watch', house: 'war', cost: {}, type: 'alteration', target: 'globe', visible: false,
      on: { 'group:enter': (c) => c.setToken('moved', 1) },
    });
    const e = blankEngine([
      probe((c, gid) => {
        c.hide(gid);
        appeared.push(c.appear(gid, { x: 5, y: 5 }));
      }),
      watch,
    ]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const sp = addSpellRecord(e.state, { cardId: 'watch', owner: 'red', host: globe, visible: false, turnsLeft: null, tokens: {} });
    executeCast(e, 'red', 'probe', globe);
    expect(appeared).toEqual([true]);
    expect(g.pos).toEqual({ x: 5, y: 5 });
    expect(sp.tokens.moved).toBeUndefined();
  });

  it('appear refuses an occupied square', () => {
    let ok: boolean | undefined;
    const e = blankEngine([probe((c, gid) => {
      c.hide(gid);
      ok = c.appear(gid, { x: 6, y: 6 });
    })]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    put(e, 'blue', { x: 6, y: 6 }, ['swordsman']);
    executeCast(e, 'red', 'probe', globe);
    expect(ok).toBe(false);
    expect(g.pos).toBeNull();
  });

  it('setHome moves the home square', () => {
    const e = blankEngine([probe((c, gid) => c.setHome(gid, { x: 8, y: 8 }))]);
    const g = createGroup(e, 'red', { x: 3, y: 3 }, 'monster', 'computer');
    spawnMinion(e, g.id, spec());
    executeCast(e, 'red', 'probe', globe);
    expect(g.home).toEqual({ x: 8, y: 8 });
  });
});

describe('summon', () => {
  it('can create an off-board group', () => {
    const e = blankEngine([defineCard({
      id: 'sm', name: 'sm', house: 'war', cost: {}, type: 'summoning', target: 'globe',
      onCast: (c) => { c.summon({ pos: null, control: 'computer', minions: [spec()] }); },
    })]);
    executeCast(e, 'red', 'sm', globe);
    const g = Object.values(e.state.groups)[0];
    expect(g.pos).toBeNull();
    expect(g.kind).toBe('monster');
  });
});
