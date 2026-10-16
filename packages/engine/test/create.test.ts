import { describe, it, expect } from 'vitest';
import { defineCard, indexCards } from '../src/cards';
import { createGame, validateDeck } from '../src/api';
import { SANCTUM_POS } from '../src/board';

const dummy = defineCard({ id: 'dummy', name: 'Dummy', house: 'war', cost: { strife: 1 }, type: 'manifestation', target: 'globe' });
const other = defineCard({ id: 'other', name: 'Other', house: 'war', cost: { strife: 1 }, type: 'manifestation', target: 'globe' });
const cards = indexCards([dummy, other]);
const deck = (n: number) => ({ house: 'war' as const, cards: Array.from({ length: n }, (_, i) => (i % 2 ? 'dummy' : 'other')) });

describe('validateDeck', () => {
  it('rejects short decks', () => {
    expect(validateDeck(deck(10), cards)).toMatch(/30/);
  });
  it('rejects more than 4 copies', () => {
    expect(validateDeck({ house: 'war', cards: Array(30).fill('dummy') }, cards)).toMatch(/4/);
  });
  it('rejects unknown cards', () => {
    expect(validateDeck({ house: 'war', cards: ['nope'] }, cards, { minDeck: 1 })).toMatch(/nope/);
  });
  it('accepts a legal deck', () => {
    const legal = { house: 'war' as const, cards: [...Array(4).fill('dummy'), ...Array(4).fill('other')] };
    expect(validateDeck(legal, cards, { minDeck: 8 })).toBeNull();
  });
});

describe('createGame', () => {
  const config = { seed: 5, decks: { red: deck(12), blue: deck(12) }, options: { skipDeckRules: true } };

  it('builds sanctums, towns and starting groups', () => {
    const s = createGame(config, cards);
    const structs = Object.values(s.structures);
    expect(structs.filter((x) => x.kind === 'sanctum')).toHaveLength(2);
    expect(structs.filter((x) => x.kind === 'town')).toHaveLength(5);
    const red = structs.find((x) => x.kind === 'sanctum' && x.owner === 'red')!;
    expect(red.pos).toEqual(SANCTUM_POS.red);
    expect(red.novices).toBe(3);
    const g = Object.values(s.groups).filter((x) => x.owner === 'red');
    expect(g).toHaveLength(1);
    expect(g[0].minionIds.map((id) => s.minions[id].cls)).toEqual(['swordsman', 'swordsman', 'archer', 'archer']);
    expect(g[0].pos).toEqual(SANCTUM_POS.red);
  });

  it('is deterministic per seed and differs across seeds', () => {
    const a = createGame(config, cards);
    const b = createGame(config, cards);
    const c = createGame({ ...config, seed: 6 }, cards);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.players.red.deck).not.toEqual(c.players.red.deck);
  });

  it('supports flat terrain and zero towns for tests', () => {
    const s = createGame({ ...config, options: { skipDeckRules: true, towns: 0, flatTerrain: true } }, cards);
    expect(Object.values(s.structures).filter((x) => x.kind === 'town')).toHaveLength(0);
    expect(new Set(Object.values(s.terrain))).toEqual(new Set(['plains']));
  });

  it('throws for an illegal deck unless rules are skipped', () => {
    expect(() => createGame({ seed: 1, decks: { red: deck(5), blue: deck(5) } }, cards)).toThrow(/deck/);
  });
});
