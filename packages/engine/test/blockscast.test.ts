import { describe, it, expect } from 'vitest';
import { submitOrders } from '../src/api';
import { defineCard } from '../src/cards';
import { spellsOn } from '../src/query';
import { addSpellRecord } from '../src/spellstore';
import { castCheck, dispel, executeCast, expireSpells } from '../src/spells';
import { emptyOrders } from '../src/types';
import { blankEngine, gameEngine, put } from './helpers';

const bolt = defineCard({ id: 'bolt', name: 'Bolt', house: 'war', cost: { strife: 1 }, type: 'manifestation', target: 'recruit' });
const calm = defineCard({ id: 'calm', name: 'Calm', house: 'war', cost: {}, type: 'manifestation', target: 'recruit' });
const lock = defineCard({
  id: 'lock', name: 'Lock', house: 'war', cost: {}, type: 'alteration', target: 'globe',
  blocksCast: (_q, _sp, a) => a.card.id === 'bolt',
});
const blueLock = defineCard({
  id: 'bluelock', name: 'BlueLock', house: 'war', cost: {}, type: 'alteration', target: 'globe',
  blocksCast: (_q, _sp, a) => a.caster === 'blue',
});
const later = defineCard({
  id: 'later', name: 'Later', house: 'war', cost: {}, type: 'alteration', target: 'globe', helper: true,
});
const fuse = defineCard({
  id: 'fuse', name: 'Fuse', house: 'war', cost: {}, type: 'conjuration', target: 'globe', duration: { turns: 1 },
  onExpire: (c) => { c.createSpell('later', { kind: 'globe' }); },
});
const all = [bolt, calm, lock, blueLock, later, fuse];
const globe = { kind: 'globe' as const };

describe('blocksCast', () => {
  it('squanders blocked casts and allows others', () => {
    const e = blankEngine(all);
    const id = put(e, 'blue', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    expect(executeCast(e, 'red', 'lock', globe)).toBe('cast');
    expect(castCheck(e, 'red', bolt, { kind: 'minion', id })).toBe(false);
    expect(executeCast(e, 'red', 'bolt', { kind: 'minion', id })).toBe('squandered');
    expect(executeCast(e, 'red', 'calm', { kind: 'minion', id })).toBe('cast');
  });

  it('stops blocking once the spell is dispelled', () => {
    const e = blankEngine(all);
    const id = put(e, 'blue', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    executeCast(e, 'red', 'lock', globe);
    dispel(e, spellsOn(e.state, globe)[0].id);
    expect(executeCast(e, 'red', 'bolt', { kind: 'minion', id })).toBe('cast');
  });

  it('receives the caster, so a block can be one-sided', () => {
    const e = blankEngine(all);
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    executeCast(e, 'red', 'bluelock', globe);
    expect(executeCast(e, 'blue', 'calm', { kind: 'minion', id })).toBe('squandered');
    expect(executeCast(e, 'red', 'calm', { kind: 'minion', id })).toBe('cast');
  });

  it('rejects a blocked cast while ordering', () => {
    const e = gameEngine([bolt, lock], Array(10).fill('bolt'));
    addSpellRecord(e.state, { cardId: 'lock', owner: 'blue', host: globe, visible: true, turnsLeft: null, tokens: {} });
    const sanctum = Object.values(e.state.structures).find((s) => s.owner === 'red')!;
    const blue = Object.values(e.state.groups).find((g) => g.owner === 'blue')!;
    const r = submitOrders(e.state, e.cards, 'red', {
      ...emptyOrders(),
      train: [{ structureId: sanctum.id, as: 'strife' }],
      cast: [{ handIndex: 0, target: { kind: 'minion', id: blue.minionIds[0] } }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/cannot target/);
  });
});

describe('onExpire', () => {
  it('runs when a spell expires by duration but not when it is dispelled', () => {
    const e = blankEngine(all);
    executeCast(e, 'red', 'fuse', globe);
    expireSpells(e);
    expect(spellsOn(e.state, globe).map((s) => s.cardId)).toEqual(['later']);

    const f = blankEngine(all);
    executeCast(f, 'red', 'fuse', globe);
    dispel(f, spellsOn(f.state, globe)[0].id);
    expect(spellsOn(f.state, globe)).toHaveLength(0);
  });
});
