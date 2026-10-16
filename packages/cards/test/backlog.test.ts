import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { pendingCards } from '../src/index';

const md = readFileSync(
  new URL('../../../docs/superpowers/plans/cards-backlog.md', import.meta.url),
  'utf8',
);
const listed = [...md.matchAll(/^- (.+) \((War|Life)\)$/gm)].map((m) => `${m[1]}|${m[2].toLowerCase()}`);

describe('cards backlog', () => {
  it('lists exactly the cards that have no script yet, each once', () => {
    const pending = pendingCards.map((c) => `${c.name}|${c.house}`).sort();
    expect([...listed].sort()).toEqual(pending);
    expect(new Set(listed).size).toBe(listed.length);
    expect(listed).toHaveLength(72);
  });
});
