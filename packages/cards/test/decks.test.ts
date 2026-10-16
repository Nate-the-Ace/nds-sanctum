import { describe, expect, it } from 'vitest';
import { validateDeck } from '@sanctum/engine';
import { cardIndex, starterDeck } from '../src/index';

describe('starterDeck', () => {
  for (const house of ['war', 'life'] as const) {
    it(`${house} is a legal, deterministic deck of its own cards`, () => {
      const deck = starterDeck(house);
      expect(deck.house).toBe(house);
      expect(validateDeck(deck, cardIndex)).toBeNull();
      expect(deck.cards.length).toBeGreaterThanOrEqual(30);
      for (const id of deck.cards) {
        expect(cardIndex[id].house).toBe(house);
        expect(cardIndex[id].helper).toBeFalsy();
      }
      expect(starterDeck(house)).toEqual(deck);
    });
  }
  it('copies follow rarity', () => {
    const war = starterDeck('war').cards;
    const count = (id: string) => war.filter((x) => x === id).length;
    expect(count('ngozi')).toBe(1); // Rare
  });
});
