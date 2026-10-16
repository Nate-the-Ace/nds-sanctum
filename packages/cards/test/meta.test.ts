import { describe, it, expect } from 'vitest';
import type { TargetType } from '@sanctum/engine';
import { allCards, cardData, cardIndex, pendingCards, playableCards } from '../src/index';

/** What "Cast on ..." means as an engine target type. */
function expectedTarget(castOn: string): TargetType | null {
  const s = castOn.toLowerCase();
  if (/^(friendly )?recruit group/.test(s)) return 'recruitGroup';
  if (/^(non-friendly )?group\b/.test(s)) return 'group';
  if (/^(friendly )?(swordsman|archer|recruit)\b/.test(s)) return 'recruit';
  if (/^globe\b/.test(s)) return 'globe';
  if (/^(square|forest|plains|mountain|volcano)\b/.test(s)) return 'square';
  if (/^town or colony\b/.test(s)) return 'structure';
  return null;
}

describe('scraped data', () => {
  it('has 102 unique cards with the right mana per house', () => {
    expect(cardData).toHaveLength(102);
    expect(new Set(cardData.map((c) => c.slug)).size).toBe(102);
    const allowed = { war: ['strife', 'clarity'], life: ['clarity', 'world'] };
    for (const c of cardData) {
      for (const k of Object.keys(c.cost)) expect(allowed[c.house], `${c.name} cost ${k}`).toContain(k);
    }
  });
});

describe.skipIf(playableCards.length === 0)('implemented cards match their scraped record', () => {
  for (const card of playableCards) {
    it(card.name, () => {
      const rec = cardData.find((c) => c.slug === card.id);
      expect(rec, `no scraped record for id "${card.id}"`).toBeDefined();
      expect(card.name).toBe(rec!.name);
      expect(card.house).toBe(rec!.house);
      expect(card.cost).toEqual(rec!.cost);
      expect(rec!.castOn, 'record has no "Cast on" clause').not.toBeNull();
      expect(card.target).toBe(expectedTarget(rec!.castOn!));
    });
  }
});

describe('registry', () => {
  it('implemented and pending partition the data', () => {
    expect(playableCards.length + pendingCards.length).toBe(cardData.length);
    for (const c of allCards) expect(cardIndex[c.id]).toBe(c);
  });

  it('has 60 playable cards (29 War, 31 Life) and 42 pending', () => {
    expect(playableCards.filter((c) => c.house === 'war')).toHaveLength(29);
    expect(playableCards.filter((c) => c.house === 'life')).toHaveLength(31);
    expect(pendingCards).toHaveLength(42);
  });
});
