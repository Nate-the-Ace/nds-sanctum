import { describe, it, expect } from 'vitest';
import { HOUSES } from '../src/houses';

describe('houses', () => {
  it('has 12 houses with distinct primary and secondary mana', () => {
    const ids = Object.keys(HOUSES);
    expect(ids).toHaveLength(12);
    for (const id of ids) {
      const h = HOUSES[id as keyof typeof HOUSES];
      expect(h.primary).not.toBe(h.secondary);
    }
  });

  it('matches the original table for war and life', () => {
    expect(HOUSES.war).toEqual({ primary: 'strife', secondary: 'clarity' });
    expect(HOUSES.life).toEqual({ primary: 'clarity', secondary: 'world' });
  });
});
