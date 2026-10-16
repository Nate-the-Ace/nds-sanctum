import { describe, expect, it } from 'vitest';
import { cardIndex, starterDeck } from '@sanctum/cards';
import { createGame, type GameState } from '@sanctum/engine';
import { turnReport } from '../src/model/report';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

/** A fresh game with the red group split in two: A (2 minions) at (4,4), B (the rest) at (5,4). */
function base(): { before: GameState; a: number; b: number; blue: number } {
  const s = createGame({ seed: 7, decks: { red: starterDeck('war'), blue: starterDeck('life') } }, cardIndex);
  const red = Object.values(s.groups).find((g) => g.owner === 'red')!;
  const blue = Object.values(s.groups).find((g) => g.owner === 'blue')!;
  red.pos = { x: 4, y: 4 };
  const b = 9000;
  const rest = red.minionIds.splice(2);
  s.groups[b] = { ...clone(red), id: b, minionIds: rest, pos: { x: 5, y: 4 } };
  for (const id of rest) s.minions[id].groupId = b;
  s.log = [];
  return { before: s, a: red.id, b, blue: blue.id };
}

const text = (r: ReturnType<typeof turnReport>) => r.sections.flatMap((x) => x.lines).join('\n');

describe('turnReport (review fixes)', () => {
  it('stops counting combat losses at the start of the next turn', () => {
    const { before, a, blue } = base();
    const after = clone(before);
    const [r1, r2] = before.groups[a].minionIds;
    after.log = [
      { type: 'combat', hi: a, lo: blue },
      { type: 'death', minion: r1 },
      { type: 'turn', turn: 2 },
      { type: 'death', minion: r2 },
    ];
    delete after.minions[r1];
    delete after.minions[r2];
    after.groups[a].minionIds = [];
    after.groups[a].pos = null;
    const combat = turnReport(before, after, cardIndex).sections.find((x) => x.title === 'Combat')!;
    expect(combat.lines.join('\n')).toMatch(/Red lost 1, Blue lost 0/);
  });

  it('reports a group joining another group, with an arrow', () => {
    const { before, a, b } = base();
    before.players.red.orders = { move: [{ groupId: a, dir: 'e' }], train: [], cast: [], discard: null };
    const after = clone(before);
    after.players.red.orders = null;
    for (const id of after.groups[a].minionIds) {
      after.minions[id].groupId = b;
      after.groups[b].minionIds.push(id);
    }
    delete after.groups[a];
    const r = turnReport(before, after, cardIndex);
    expect(text(r)).toMatch(/Red group \(2\) at \(5,5\) joined the Red group at \(6,5\)\./);
    expect(r.moves).toEqual([{ groupId: a, owner: 'red', from: { x: 4, y: 4 }, to: { x: 5, y: 4 } }]);
  });

  it('reports a blocked move', () => {
    const { before, a } = base();
    before.players.red.orders = { move: [{ groupId: a, dir: 's' }], train: [], cast: [], discard: null };
    const after = clone(before);
    const r = turnReport(before, after, cardIndex);
    expect(text(r)).toMatch(/Red group's move to \(5,6\) was blocked\./);
    expect(r.moves).toHaveLength(0);
  });

  it('uses the size before the turn on move lines', () => {
    const { before, b } = base();
    const after = clone(before);
    const n = before.groups[b].minionIds.length;
    after.groups[b].pos = { x: 5, y: 5 };
    after.groups[b].minionIds = after.groups[b].minionIds.slice(0, 1);
    expect(text(turnReport(before, after, cardIndex))).toMatch(new RegExp(`Red group \\(${n}\\) moved \\(6,5\\) to \\(6,6\\)`));
  });

  it('draws no arrow for a displaced group that ended up far away', () => {
    const { before, b } = base();
    const after = clone(before);
    after.groups[b].pos = { x: 8, y: 8 };
    const r = turnReport(before, after, cardIndex);
    expect(r.moves).toHaveLength(0);
    expect(text(r)).toMatch(/Red group \(\d\) was displaced from \(6,5\) to \(9,9\)\./);
  });

  it('reports initiative changes, groups changing sides and spells wearing off', () => {
    const { before, a, b } = base();
    const minion = before.groups[a].minionIds[0];
    before.initiative = 'red';
    before.spells.push({ id: 7777, cardId: 'flaming-sword', owner: 'red', host: { kind: 'minion', id: minion }, visible: true, turnsLeft: 1, tokens: {} });
    const after = clone(before);
    after.initiative = 'blue';
    after.spells = [];
    after.groups[b].owner = 'blue';
    const t = text(turnReport(before, after, cardIndex));
    expect(t).toMatch(/Blue took the initiative\./);
    expect(t).toMatch(/Red group at \(6,5\) went over to Blue\./);
    expect(t).toMatch(/Flaming Sword on Red .* wore off\./);
  });

  it('does not call a dispelled spell worn off', () => {
    const { before, a } = base();
    before.spells.push({ id: 7777, cardId: 'flaming-sword', owner: 'red', host: { kind: 'minion', id: before.groups[a].minionIds[0] }, visible: true, turnsLeft: 2, tokens: {} });
    const after = clone(before);
    after.spells = [];
    after.log = [{ type: 'dispel', card: 'flaming-sword' }];
    expect(text(turnReport(before, after, cardIndex))).not.toMatch(/wore off/);
  });
});
