import { describe, it, expect } from 'vitest';
import { nextRandom, randInt, shuffle } from '../src/rng';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = { seed: 42 };
    const b = { seed: 42 };
    expect([nextRandom(a), nextRandom(a), nextRandom(a)]).toEqual([nextRandom(b), nextRandom(b), nextRandom(b)]);
  });

  it('returns values in [0,1)', () => {
    const s = { seed: 7 };
    for (let i = 0; i < 1000; i++) {
      const v = nextRandom(s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('randInt stays in range', () => {
    const s = { seed: 9 };
    for (let i = 0; i < 500; i++) {
      const v = randInt(s, 6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
    }
  });

  it('shuffle keeps the elements and is deterministic', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = shuffle({ seed: 5 }, input);
    const b = shuffle({ seed: 5 }, input);
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
