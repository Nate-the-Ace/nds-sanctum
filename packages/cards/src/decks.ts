import type { DeckConfig } from '@sanctum/engine';
import { cardData, cardIndex } from './index';

const COPIES: Record<string, number> = { Common: 3, Uncommon: 2, Rare: 1, 'Very Rare': 1 };

/** A ready-made deck of every implemented, playable card of a house, with copies by rarity. */
export function starterDeck(house: 'war' | 'life'): DeckConfig {
  const cards: string[] = [];
  for (const d of cardData) {
    const def = cardIndex[d.slug];
    if (d.house !== house || !def || def.helper) continue;
    for (let i = 0; i < (COPIES[d.rarity] ?? 1); i++) cards.push(d.slug);
  }
  return { house, cards };
}
