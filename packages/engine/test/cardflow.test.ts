import { describe, it, expect } from 'vitest';
import { validateDeck } from '../src/api';
import { defineCard, indexCards } from '../src/cards';
import { executeCast } from '../src/spells';
import { beginTurn } from '../src/turn';
import { blankEngine, put } from './helpers';

const probe = (id: string, onCast: NonNullable<Parameters<typeof defineCard>[0]['onCast']>, target: 'recruit' | 'globe' = 'globe') =>
  defineCard({ id, name: id, house: 'war', cost: {}, type: 'manifestation', target, onCast });

describe('spell:cast', () => {
  const listener = defineCard({
    id: 'listener', name: 'listener', house: 'life', cost: {}, type: 'alteration', target: 'recruit',
    on: {
      'spell:cast': (c, ev) => {
        if (ev.ref?.kind !== 'minion' || c.host.kind !== 'minion' || ev.ref.id !== c.host.id) return;
        if (ev.data.type === 'alteration' && ev.data.spellId !== c.spell.id && ev.data.caster === 'red') c.setToken('n', c.token('n') + 1);
      },
    },
  });
  const buff = defineCard({ id: 'buff', name: 'buff', house: 'war', cost: {}, type: 'alteration', target: 'recruit' });
  const zap = defineCard({ id: 'zap', name: 'zap', house: 'war', cost: {}, type: 'manifestation', target: 'recruit' });

  it('is dispatched on the target after each successful cast', () => {
    const e = blankEngine([listener, buff, zap]);
    const m = put(e, 'red', { x: 4, y: 4 }, ['archer']).minionIds[0];
    const t = { kind: 'minion' as const, id: m };
    executeCast(e, 'red', 'listener', t);
    const sp = () => e.state.spells.find((s) => s.cardId === 'listener')!;
    expect(sp().tokens.n ?? 0).toBe(0); // its own cast does not count
    executeCast(e, 'red', 'buff', t);
    expect(sp().tokens.n).toBe(1);
    expect(executeCast(e, 'red', 'buff', t)).toBe('squandered');
    executeCast(e, 'red', 'zap', t);
    expect(sp().tokens.n).toBe(1);
  });
});

describe('levels, deck and hand', () => {
  it('addLevel raises the base level up to 5', () => {
    const up = probe('up', (c, t) => { if (t.kind === 'minion') c.addLevel(t.id, 3); }, 'recruit');
    const e = blankEngine([up]);
    const m = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    executeCast(e, 'red', 'up', { kind: 'minion', id: m });
    expect(e.state.minions[m].base.level).toBe(4);
    executeCast(e, 'red', 'up', { kind: 'minion', id: m });
    expect(e.state.minions[m].base.level).toBe(5);
  });

  it('removeTopCard removes the top card of a deck', () => {
    let got: string | undefined = 'unset';
    const mill = probe('mill', (c) => { got = c.removeTopCard('blue'); });
    const e = blankEngine([mill]);
    e.state.players.blue.deck = ['a', 'b'];
    executeCast(e, 'red', 'mill', { kind: 'globe' });
    expect(got).toBe('a');
    expect(e.state.players.blue.deck).toEqual(['b']);
    e.state.players.blue.deck = [];
    executeCast(e, 'red', 'mill', { kind: 'globe' });
    expect(got).toBeUndefined();
  });

  it('reveal stores intel until the next start of turn', () => {
    const spy = probe('spy', (c) => c.reveal('red', 'blue'));
    const e = blankEngine([spy]);
    e.state.players.blue.deck = ['x', 'y'];
    executeCast(e, 'red', 'spy', { kind: 'globe' });
    expect(e.state.players.red.intel).toEqual([{ source: 'spy', side: 'blue', cardId: 'x' }]);
    expect(e.state.players.blue.intel).toBeUndefined();
    e.state.turn += 1;
    beginTurn(e, false);
    expect(e.state.players.red.intel).toBeUndefined();
  });

  it('addToHand puts a card into a hand', () => {
    const gift = probe('gift', (c) => c.addToHand('red', 'gift'));
    const bad = probe('bad', (c) => c.addToHand('red', 'nope'));
    const e = blankEngine([gift, bad]);
    executeCast(e, 'red', 'gift', { kind: 'globe' });
    expect(e.state.players.red.hand).toEqual(['gift']);
    expect(() => executeCast(e, 'red', 'bad', { kind: 'globe' })).toThrow(/unknown card "nope"/);
  });
});

describe('copyOf', () => {
  const base = defineCard({ id: 'base', name: 'Base', house: 'war', cost: { strife: 1 }, type: 'alteration', target: 'recruit' });
  const copy = defineCard({ id: 'base-2', name: 'Base (2 tokens)', house: 'war', cost: { strife: 2 }, type: 'alteration', target: 'recruit', copyOf: 'base' });

  it('a hand copy cannot be put in a deck', () => {
    expect(validateDeck({ house: 'war', cards: Array(30).fill('base-2') }, indexCards([base, copy]))).toMatch(/hand copy/);
    expect(validateDeck({ house: 'war', cards: Array(30).fill('base').slice(0, 4).concat(Array(26).fill('base-2')) }, indexCards([base, copy]))).toMatch(/hand copy/);
  });

  it('a copy and its original are exclusive together', () => {
    const e = blankEngine([base, copy]);
    const t = { kind: 'minion' as const, id: put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0] };
    expect(executeCast(e, 'red', 'base', t)).toBe('cast');
    expect(executeCast(e, 'red', 'base-2', t)).toBe('squandered');
  });
});
