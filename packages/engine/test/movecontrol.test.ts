import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { runMovement } from '../src/movement';
import { executeCast } from '../src/spells';
import { blankEngine, put } from './helpers';

const twice = defineCard({
  id: 'twice', name: 'Twice', house: 'war', cost: {}, type: 'manifestation', target: 'recruitGroup',
  onCast: (c, t) => { if (t.kind === 'group') c.setMovesTwice(t.id); },
});
const halt = defineCard({
  id: 'halt', name: 'Halt', house: 'war', cost: {}, type: 'manifestation', target: 'recruitGroup',
  onCast: (c, t) => { if (t.kind === 'group') c.setMoveOrder(t.id, null); },
});
const probe = defineCard({
  id: 'probe', name: 'Probe', house: 'war', cost: {}, type: 'alteration', target: 'recruitGroup',
  onCast: (c, t) => {
    if (t.kind !== 'group') return;
    const bit = { n: 1, e: 2, s: 4, w: 8 } as const;
    c.setToken('mask', c.legalDirections(t.id).reduce((m, d) => m + bit[d], 0));
  },
});
const jump = defineCard({
  id: 'jump', name: 'Jump', house: 'war', cost: {}, type: 'manifestation', target: 'recruitGroup',
  onCast: (c, t) => { if (t.kind === 'group') c.moveGroup(t.id, { x: 8, y: 2 }); },
});
const seen: string[] = [];
const watch = defineCard({
  id: 'watch', name: 'Watch', house: 'war', cost: {}, type: 'conjuration', target: 'globe',
  on: {
    'group:exit': (_c, ev) => { seen.push(`exit ${JSON.stringify(ev.data)}`); },
    'group:move': (_c, ev) => { seen.push(`move ${JSON.stringify(ev.data)}`); },
    'group:enter': (_c, ev) => { seen.push(`enter ${JSON.stringify(ev.data)}`); },
  },
});
const all = [twice, halt, probe, jump, watch];

describe('movement control', () => {
  it('moves a "moves twice" group twice along its order, then clears the flag', () => {
    const e = blankEngine(all);
    const g = put(e, 'red', { x: 3, y: 3 }, ['swordsman']);
    g.moveOrder = 'e';
    executeCast(e, 'red', 'twice', { kind: 'group', id: g.id });
    runMovement(e);
    expect(g.pos).toEqual({ x: 5, y: 3 });
    expect(g.movesTwice).toBe(false);
    expect(g.moveOrder).toBeNull();
  });

  it('a spell can cancel an order', () => {
    const e = blankEngine(all);
    const g = put(e, 'red', { x: 3, y: 3 }, ['swordsman']);
    g.moveOrder = 'e';
    executeCast(e, 'red', 'halt', { kind: 'group', id: g.id });
    runMovement(e);
    expect(g.pos).toEqual({ x: 3, y: 3 });
  });

  it('the second step is blocked like any move (water stops it)', () => {
    const e = blankEngine(all);
    e.state.terrain['5,3'] = 'water';
    const g = put(e, 'red', { x: 3, y: 3 }, ['swordsman']);
    g.moveOrder = 'e';
    executeCast(e, 'red', 'twice', { kind: 'group', id: g.id });
    runMovement(e);
    expect(g.pos).toEqual({ x: 4, y: 3 });
  });

  it('lists legal directions, skipping the board edge and blocked terrain', () => {
    const e = blankEngine(all);
    e.state.terrain['1,5'] = 'mountain';
    const g = put(e, 'red', { x: 0, y: 5 }, ['swordsman']);
    executeCast(e, 'red', 'probe', { kind: 'group', id: g.id });
    expect(e.state.spells[0].tokens.mask).toBe(1 + 4); // n and s only: east is a mountain, west is off the board
  });

  it('moveGroup relocates into an empty square and refuses an occupied one', () => {
    const e = blankEngine(all);
    const g = put(e, 'red', { x: 3, y: 3 }, ['swordsman']);
    executeCast(e, 'red', 'jump', { kind: 'group', id: g.id });
    expect(g.pos).toEqual({ x: 8, y: 2 });
    const h = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    executeCast(e, 'red', 'jump', { kind: 'group', id: h.id });
    expect(h.pos).toEqual({ x: 4, y: 4 });
  });

  it('moveGroup dispatches exit, move, enter once, and nothing when refused', () => {
    const e = blankEngine(all);
    seen.length = 0;
    executeCast(e, 'red', 'watch', { kind: 'globe' });
    const g = put(e, 'red', { x: 3, y: 3 }, ['swordsman']);
    executeCast(e, 'red', 'jump', { kind: 'group', id: g.id });
    const from = { x: 3, y: 3 };
    const to = { x: 8, y: 2 };
    expect(seen).toEqual([
      `exit ${JSON.stringify({ from })}`,
      `move ${JSON.stringify({ from, to })}`,
      `enter ${JSON.stringify({ to })}`,
    ]);
    seen.length = 0;
    const h = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    executeCast(e, 'red', 'jump', { kind: 'group', id: h.id }); // destination occupied
    expect(seen).toEqual([]);
  });
});
