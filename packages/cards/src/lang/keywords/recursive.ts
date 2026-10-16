import type { CardDef, Mana } from '@sanctum/engine';
import { card, type CardInput } from '../card';
import { defineKeyword } from '../registry';
import type { Keyword } from '../types';

/** Highest token count of a recursive copy; casting the copy at the cap returns another copy at the cap. */
export const RECURSIVE_MAX = 8;

export interface RecursiveKeyword extends Keyword {
  kind: 'recursive';
  tokens: number;
  next: string;
}
/** "Recursive N": the spell has N tokens; casting it adds card `next` (the copy with one more token) to the caster's hand. */
export const Recursive = (tokens: number, next: string): RecursiveKeyword => ({ kind: 'recursive', tokens, next });

defineKeyword<RecursiveKeyword>({
  kind: 'recursive', term: 'Recursive', tier: 'house',
  gloss: `Recursive N: the spell has N tokens. When it is cast, a copy with one more token, costing 1 more mana, is added to your hand (at most ${RECURSIVE_MAX} tokens). Copies never go in a deck.`,
  print: (k) => ({ layout: 'inline', text: `Recursive ${k.tokens}` }),
  compile: (k) => ({
    onCast: (c) => {
      if (c.spell.owner !== 'neutral') c.addToHand(c.spell.owner, k.next);
    },
  }),
});

/** Card id of the copy with `tokens` tokens (the card itself has 1). */
export const recursiveId = (id: string, tokens: number): string => (tokens === 1 ? id : `${id}-${tokens}`);

/**
 * A recursive card and its hand copies with 2..RECURSIVE_MAX tokens. `keywordsFor(t)` gives the keywords of the copy
 * with t tokens; copy t costs t-1 more of the card's first mana type.
 */
// RULING: the original has no stated cap; copies are separate card ids, so one is needed. 9+ mana for one spell does not
// happen in play, so the cap is never felt.
export function recursive(input: Omit<CardInput, 'keywords' | 'copyOf'>, keywordsFor: (tokens: number) => Keyword[]): CardDef[] {
  const mana = Object.keys(input.cost)[0] as Mana;
  const out: CardDef[] = [];
  for (let t = 1; t <= RECURSIVE_MAX; t++) {
    out.push(card({
      ...input,
      id: recursiveId(input.id, t),
      name: t === 1 ? input.name : `${input.name} (${t} tokens)`,
      cost: { ...input.cost, [mana]: (input.cost[mana] ?? 0) + t - 1 },
      ...(t === 1 ? {} : { copyOf: input.id }),
      keywords: [Recursive(t, recursiveId(input.id, Math.min(t + 1, RECURSIVE_MAX))), ...keywordsFor(t)],
    }));
  }
  return out;
}
