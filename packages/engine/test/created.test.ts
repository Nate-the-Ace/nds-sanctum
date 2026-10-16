import { describe, it, expect } from 'vitest';
import { confirmOrders, submitOrders, type Result } from '../src/api';
import { defineCard } from '../src/cards';
import { addSpellRecord } from '../src/spellstore';
import { targetLegal } from '../src/spells';
import { emptyOrders, type GameState } from '../src/types';
import { blankEngine, gameEngine, put } from './helpers';

const watch = defineCard({
  id: 'watch', name: 'Watch', house: 'war', cost: {}, type: 'alteration', target: 'structure',
  on: { 'minion:created': (c, ev) => c.setToken('last', ev.data.minionId) },
});
const cloak = defineCard({
  id: 'cloak', name: 'Cloak', house: 'war', cost: {}, type: 'alteration', target: 'recruit', helper: true,
  stats: () => ({ concealed: true }),
});
const bolt = defineCard({ id: 'bolt', name: 'Bolt', house: 'war', cost: {}, type: 'manifestation', target: 'recruit' });
const sight = defineCard({
  id: 'sight', name: 'Sight', house: 'war', cost: {}, type: 'manifestation', target: 'recruit', ignoresConcealment: true,
});

function must(r: Result): GameState {
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

describe('minion:created', () => {
  it('fires on the structure when training creates a recruit', () => {
    const e = gameEngine([watch]);
    const sanctum = Object.values(e.state.structures).find((s) => s.owner === 'red')!;
    addSpellRecord(e.state, { cardId: 'watch', owner: 'red', host: { kind: 'structure', id: sanctum.id }, visible: true, turnsLeft: null, tokens: {} });
    let s = must(submitOrders(e.state, e.cards, 'red', { ...emptyOrders(), train: [{ structureId: sanctum.id, as: 'swordsman' }] }));
    s = must(confirmOrders(s, e.cards, 'red'));
    s = must(confirmOrders(s, e.cards, 'blue'));
    const last = s.spells.find((sp) => sp.cardId === 'watch')!.tokens.last;
    expect(s.minions[last].cls).toBe('swordsman');
    expect(s.minions[last].owner).toBe('red');
    const group = Object.values(s.groups).find((g) => g.minionIds.includes(last))!;
    expect(group.pos).toEqual(sanctum.pos);
  });
});

describe('concealed stat', () => {
  it('hides a minion from enemy individual spells only', () => {
    const e = blankEngine([bolt, sight, cloak]);
    const id = put(e, 'blue', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    addSpellRecord(e.state, { cardId: 'cloak', owner: 'blue', host: { kind: 'minion', id }, visible: true, turnsLeft: null, tokens: {} });
    const ref = { kind: 'minion' as const, id };
    expect(targetLegal(e, bolt, 'red', ref)).toBe(false);
    expect(targetLegal(e, bolt, 'blue', ref)).toBe(true);
    expect(targetLegal(e, sight, 'red', ref)).toBe(true);
  });
});
