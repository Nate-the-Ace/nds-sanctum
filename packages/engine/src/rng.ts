export interface Seeded { seed: number }

/** mulberry32. Mutates `s.seed`, returns a float in [0,1). */
export function nextRandom(s: Seeded): number {
  s.seed = (s.seed + 0x6d2b79f5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(s: Seeded, n: number): number {
  return Math.floor(nextRandom(s) * n);
}

/** Fisher-Yates on a copy. */
export function shuffle<T>(s: Seeded, input: readonly T[]): T[] {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(s, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pick<T>(s: Seeded, input: readonly T[]): T {
  return input[randInt(s, input.length)];
}
