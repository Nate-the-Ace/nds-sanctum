import { describe, expect, it } from 'vitest';
import { defineCard, indexCards } from '../src/cards';
import { createGame } from '../src/api';
import { emptyOrders } from '../src/types';
import { checkOrders, legalTargets, viewStats } from '../src/view';

const globeCard = defineCard({ id: 'g', name: 'g', house: 'war', cost: { strife: 1 }, type: 'manifestation', target: 'globe' });
const squareCard = defineCard({ id: 's', name: 's', house: 'war', cost: {}, type: 'manifestation', target: 'square' });
const recruitCard = defineCard({ id: 'r', name: 'r', house: 'war', cost: {}, type: 'alteration', target: 'recruit' });
const groupCard = defineCard({ id: 'gr', name: 'gr', house: 'war', cost: {}, type: 'alteration', target: 'recruitGroup' });
const cards = indexCards([globeCard, squareCard, recruitCard, groupCard]);
const game = () =>
  createGame(
    { seed: 3, decks: { red: { house: 'war', cards: [] }, blue: { house: 'war', cards: [] } },
      options: { towns: 0, flatTerrain: true, skipDeckRules: true } },
    cards,
  );

describe('engine view helpers', () => {
  it('viewStats reads computed stats and leaves the state alone', () => {
    const s = game();
    const before = JSON.stringify(s);
    const m = Object.values(s.minions).find((x) => x.owner === 'red' && x.cls === 'swordsman')!;
    expect(viewStats(s, cards, m.id)).toMatchObject({ hand: 2, armor: 1, maxHp: 7 });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('legalTargets lists targets per target type', () => {
    const s = game();
    expect(legalTargets(s, cards, 'red', 'g')).toEqual([{ kind: 'globe' }]);
    const squares = legalTargets(s, cards, 'red', 's');
    expect(squares.length).toBeGreaterThan(60);
    expect(squares.every((r) => r.kind === 'square')).toBe(true);
    expect(legalTargets(s, cards, 'red', 'r').length).toBe(8); // both starting groups' recruits
    const groups = legalTargets(s, cards, 'red', 'gr');
    expect(groups.map((r) => r.kind)).toEqual(['group', 'group']);
    expect(legalTargets(s, cards, 'red', 'nope')).toEqual([]);
  });

  it('checkOrders returns the engine error text or null', () => {
    const s = game();
    expect(checkOrders(s, cards, 'red', emptyOrders())).toBeNull();
    const bad = { ...emptyOrders(), cast: [{ handIndex: 0, target: { kind: 'globe' as const } }] };
    expect(checkOrders(s, cards, 'red', bad)).toMatch(/invalid hand index/);
  });
});
