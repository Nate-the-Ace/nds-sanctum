import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { allCards, cardFace, keywordGlossary } from '../src/index';

const files = (dir: string) =>
  readdirSync(new URL(`../src/${dir}/`, import.meta.url))
    .filter((f) => f.endsWith('.ts') && f !== 'index.ts')
    .map((f) => ({ f: `${dir}/${f}`, src: readFileSync(new URL(`../src/${dir}/${f}`, import.meta.url), 'utf8') }));

describe('migration to keywords', () => {
  it('no card file is hand-written with defineCard', () => {
    const offenders = [...files('war'), ...files('life')].filter(({ src }) => src.includes('defineCard(')).map((x) => x.f);
    expect(offenders).toEqual([]);
  });

  it('every card has a printed face', () => {
    for (const c of allCards) {
      const face = cardFace(c.id);
      expect(face, c.id).toBeDefined();
      expect(face!.lines.length, c.id).toBeGreaterThanOrEqual(1);
      expect(face!.lines[0], c.id).toMatch(/\.$/);
    }
  });

  it('the glossary lists every keyword with a reminder, core keywords first', () => {
    const g = keywordGlossary();
    expect(g.length).toBeGreaterThanOrEqual(20);
    for (const e of g) {
      expect(e.gloss.length, e.kind).toBeGreaterThan(10);
      expect(e.term.length, e.kind).toBeGreaterThan(0);
    }
    const tiers = g.map((e) => e.tier);
    expect(tiers).toEqual([...tiers].sort((a, b) => ['core', 'house', 'oneoff'].indexOf(a) - ['core', 'house', 'oneoff'].indexOf(b)));
  });
});
