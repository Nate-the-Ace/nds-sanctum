import { indexCards, type CardDef } from '@sanctum/engine';
import data from '../data/cards.json';
import { lifeCards } from './life';
import { warCards } from './war';

export interface CardData {
  sid: number;
  name: string;
  slug: string;
  house: 'war' | 'life';
  expansion: string | null;
  rarity: string;
  cost: Partial<Record<'strife' | 'clarity' | 'world', number>>;
  flavor: string | null;
  text: string;
  castOn: string | null;
}

/** Scraped records for every War and Life card (implemented or not). */
export const cardData = data as CardData[];
/** Card scripts that exist, ready to hand to `createGame`. */
export const allCards: CardDef[] = [...warCards, ...lifeCards];
export const cardIndex = indexCards(allCards);
/** Scraped cards with no script yet (see docs/superpowers/plans/cards-backlog.md). */
export const pendingCards = cardData.filter((c) => !cardIndex[c.slug]);
