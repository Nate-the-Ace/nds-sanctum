import { describe, it, expect } from 'vitest';
import { validateDeck } from '../src/api';
import { defineCard, indexCards } from '../src/cards';
import { spellsOn } from '../src/query';
import { executeCast } from '../src/spells';
import { computeStats } from '../src/stats';
import { blankEngine, put } from './helpers';

const scar = defineCard({
  id: 'scar', name: 'Scar', house: 'war', cost: {}, type: 'alteration', target: 'recruit', helper: true,
  stats: () => ({ armor: 2 }),
});
const maker = defineCard({
  id: 'maker', name: 'Maker', house: 'war', cost: {}, type: 'manifestation', target: 'recruit',
  onCast: (c, t) => { if (t.kind === 'minion') c.createSpell('scar', t); },
});
const timed = defineCard({
  id: 'timed', name: 'Timed', house: 'war', cost: {}, type: 'manifestation', target: 'recruit',
  onCast: (c, t) => { if (t.kind === 'minion') c.createSpell('scar', t, { turns: 2 }); },
});
const broken = defineCard({
  id: 'broken', name: 'Broken', house: 'war', cost: {}, type: 'manifestation', target: 'recruit',
  onCast: (c, t) => { if (t.kind === 'minion') c.createSpell('nope', t); },
});
const all = [scar, maker, timed, broken];

describe('ctx.createSpell', () => {
  it('adds a helper spell owned by the caster and applies its stats', () => {
    const e = blankEngine(all);
    const id = put(e, 'blue', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    expect(executeCast(e, 'red', 'maker', { kind: 'minion', id })).toBe('cast');
    const spells = spellsOn(e.state, { kind: 'minion', id });
    expect(spells).toHaveLength(1);
    expect(spells[0]).toMatchObject({ cardId: 'scar', owner: 'red', visible: true, turnsLeft: null });
    expect(computeStats(e, id).armor).toBe(3);
  });

  it('ignores exclusivity: creating twice stacks', () => {
    const e = blankEngine(all);
    const id = put(e, 'blue', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    executeCast(e, 'red', 'maker', { kind: 'minion', id });
    executeCast(e, 'red', 'maker', { kind: 'minion', id });
    expect(computeStats(e, id).armor).toBe(5);
  });

  it('honours a turns override', () => {
    const e = blankEngine(all);
    const id = put(e, 'blue', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    executeCast(e, 'red', 'timed', { kind: 'minion', id });
    expect(spellsOn(e.state, { kind: 'minion', id })[0].turnsLeft).toBe(2);
  });

  it('throws for an unknown card id', () => {
    const e = blankEngine(all);
    const id = put(e, 'blue', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    expect(() => executeCast(e, 'red', 'broken', { kind: 'minion', id })).toThrow(/unknown card "nope"/);
  });
});

describe('helper cards and decks', () => {
  it('validateDeck rejects a helper card', () => {
    const cards = indexCards(all);
    expect(validateDeck({ house: 'war', cards: ['scar'] }, cards, { minDeck: 1 })).toMatch(/helper/);
  });
});
