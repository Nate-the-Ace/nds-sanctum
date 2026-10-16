import { describe, expect, it } from 'vitest';
import { cardIndex } from '@sanctum/cards';
import { confirmOrders, createGame, emptyOrders, submitOrders } from '@sanctum/engine';
import { starterDeck } from '@sanctum/cards';
import { turnReport } from '../src/model/report';

describe('turnReport', () => {
  it('reports movement and new units after a resolved turn', () => {
    const before = createGame({ seed: 5, decks: { red: starterDeck('war'), blue: starterDeck('war') } }, cardIndex);
    const g = Object.values(before.groups).find((x) => x.owner === 'red')!;
    const sanctum = Object.values(before.structures).find((x) => x.kind === 'sanctum' && x.owner === 'red')!;
    const orders = { ...emptyOrders(), move: [{ groupId: g.id, dir: 'e' as const }], train: [{ structureId: sanctum.id, as: 'archer' as const }] };
    const a = submitOrders(before, cardIndex, 'red', orders);
    if (!a.ok) throw new Error(a.error);
    const b = confirmOrders(a.state, cardIndex, 'red');
    if (!b.ok) throw new Error(b.error);
    const c = confirmOrders(b.state, cardIndex, 'blue');
    if (!c.ok) throw new Error(c.error);
    const report = turnReport(b.state, c.state, cardIndex);
    const text = report.sections.flatMap((x) => x.lines).join('\n');
    expect(report.turn).toBe(1);
    expect(text).toMatch(/Red group .* moved/);
    expect(text).toMatch(/archer/i);
    expect(report.moves.length).toBeGreaterThan(0);
  });
});

/** Resolve one turn from `start` with the given orders; returns the report. */
function resolve(start: ReturnType<typeof createGame>, red = emptyOrders(), blue = emptyOrders()) {
  const a = submitOrders(start, cardIndex, 'red', red);
  if (!a.ok) throw new Error(a.error);
  const b = submitOrders(a.state, cardIndex, 'blue', blue);
  if (!b.ok) throw new Error(b.error);
  const c = confirmOrders(b.state, cardIndex, 'red');
  if (!c.ok) throw new Error(c.error);
  const d = confirmOrders(c.state, cardIndex, 'blue');
  if (!d.ok) throw new Error(d.error);
  return { before: b.state, after: d.state, report: turnReport(b.state, d.state, cardIndex) };
}

describe('turnReport (playtest fixes)', () => {
  it('says who lost what in a combat and when a group is wiped out', () => {
    const start = createGame({ seed: 7, decks: { red: starterDeck('war'), blue: starterDeck('life') } }, cardIndex);
    const red = Object.values(start.groups).find((x) => x.owner === 'red')!;
    const blue = Object.values(start.groups).find((x) => x.owner === 'blue')!;
    red.pos = { x: 4, y: 4 };
    blue.pos = { x: 4, y: 5 };
    // Make the fight one-sided: every red minion but one is gone, so the red group is wiped out.
    for (const id of red.minionIds.slice(1)) delete start.minions[id];
    red.minionIds = red.minionIds.slice(0, 1);
    const { report } = resolve(start);
    const combat = report.sections.find((x) => x.title === 'Combat')!;
    expect(combat).toBeTruthy();
    const line = combat.lines.join('\n');
    expect(line).not.toMatch(/fought .* group at \(\d+,\d+\)\.$/);
    expect(line).toMatch(/Red lost 1/);
    expect(line).toMatch(/Red group was wiped out/);
  });

  it('merges identical lines with a count', () => {
    const start = createGame({ seed: 7, decks: { red: starterDeck('war'), blue: starterDeck('life') } }, cardIndex);
    const red = Object.values(start.groups).find((x) => x.owner === 'red')!;
    const blue = Object.values(start.groups).find((x) => x.owner === 'blue')!;
    red.pos = { x: 4, y: 4 };
    blue.pos = { x: 4, y: 5 };
    for (const id of red.minionIds) start.minions[id].hp = 1;
    const { report } = resolve(start);
    const deaths = report.sections.find((x) => x.title === 'Casualties')!.lines;
    expect(new Set(deaths).size).toBe(deaths.length);
    expect(deaths.join('\n')).toMatch(/\(×\d\)/);
  });

  it('reports novices trained as mana', () => {
    const start = createGame({ seed: 7, decks: { red: starterDeck('war'), blue: starterDeck('life') } }, cardIndex);
    const sanctum = Object.values(start.structures).find((x) => x.kind === 'sanctum' && x.owner === 'red')!;
    const { report } = resolve(start, { ...emptyOrders(), train: [{ structureId: sanctum.id, as: 'strife' }] });
    const text = report.sections.flatMap((x) => x.lines).join('\n');
    expect(text).toMatch(/Red trained a novice as Strife mana/);
  });
});
