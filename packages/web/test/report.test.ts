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
