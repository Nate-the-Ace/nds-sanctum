import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseCard, parseHouseList, slugify } from '../parse.mjs';

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'latin1');

describe('slugify', () => {
  it('lowercases, drops apostrophes and hyphenates', () => {
    expect(slugify("Ngozi's Way")).toBe('ngozis-way');
    expect(slugify('Good of the Many')).toBe('good-of-the-many');
    expect(slugify('Adriel’s Mantle')).toBe('adriels-mantle');
  });
});

describe('parseHouseList', () => {
  it('lists every card on a house page', () => {
    const cards = parseHouseList(fixture('house-2.html'));
    expect(cards).toHaveLength(52);
    expect(cards).toContainEqual({ sid: 330, name: 'Pyx' });
    expect(cards.every((c) => Number.isInteger(c.sid) && c.name.length > 0)).toBe(true);
  });
});

describe('parseCard', () => {
  it('parses a classic card with flavor text', () => {
    const c = parseCard(fixture('card-94.html'), 94);
    expect(c).toMatchObject({
      sid: 94, name: 'Flaming Sword', slug: 'flaming-sword', house: 'war',
      expansion: 'Classic', rarity: 'Common', cost: { strife: 2 },
      text: 'Cast on swordsman. Swordsman gets +2 hand damage.', castOn: 'swordsman',
    });
    expect(c.flavor).toContain('Flaming Sword is to be wielded');
  });

  it('parses a two-mana card of another house', () => {
    const c = parseCard(fixture('card-330.html'), 330);
    expect(c).toMatchObject({
      name: 'Pyx', house: 'life', cost: { clarity: 1, world: 1 },
      text: 'Cast on group. Every member of group is fully healed.', castOn: 'group',
    });
  });

  it('gives flavor null when the card has none, and decodes entities', () => {
    const c = parseCard(fixture('card-1089.html'), 1089);
    expect(c.flavor).toBeNull();
    expect(c.expansion).toBe('Allies & Traitors');
    expect(c.cost).toEqual({ strife: 4, clarity: 4 });
    expect(c.rarity).toBe('Common');
    expect(c.text.startsWith('Cast on globe.')).toBe(true);
  });

  it('throws on an unknown mana image', () => {
    const html = fixture('card-94.html').replace('/images/02mana.gif', '/images/99mana.gif');
    expect(() => parseCard(html, 94)).toThrow(/mana image 99/);
  });
});
