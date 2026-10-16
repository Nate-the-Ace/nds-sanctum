import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { distance2 } from '../src/board';
import { runMovement } from '../src/movement';
import { groupAt, groupsAt } from '../src/query';
import { addSpellRecord } from '../src/spellstore';
import { createGroup, spawnMinion, recruitSpec } from '../src/units';
import { blankEngine, gameEngine, put } from './helpers';

const sw = (n: number) => Array<'swordsman'>(n).fill('swordsman');

describe('movement', () => {
  it('moves a group one square and clears the order', () => {
    const e = blankEngine();
    const g = put(e, 'red', { x: 4, y: 4 }, sw(2));
    g.moveOrder = 'e';
    runMovement(e);
    expect(g.pos).toEqual({ x: 5, y: 4 });
    expect(g.moveOrder).toBeNull();
  });

  it('does not enter a hostile-occupied square', () => {
    const e = blankEngine();
    const a = put(e, 'red', { x: 4, y: 4 }, sw(1));
    put(e, 'blue', { x: 5, y: 4 }, sw(1));
    a.moveOrder = 'e';
    runMovement(e);
    expect(a.pos).toEqual({ x: 4, y: 4 });
  });

  it('gives a contested empty square to the initiative player', () => {
    for (const init of ['red', 'blue'] as const) {
      const e = blankEngine();
      e.state.initiative = init;
      const r = put(e, 'red', { x: 4, y: 4 }, sw(1));
      const b = put(e, 'blue', { x: 6, y: 4 }, sw(1));
      r.moveOrder = 'e';
      b.moveOrder = 'w';
      runMovement(e);
      expect(groupAt(e.state, { x: 5, y: 4 })?.owner).toBe(init);
      expect(r.pos).toEqual(init === 'red' ? { x: 5, y: 4 } : { x: 4, y: 4 });
      expect(b.pos).toEqual(init === 'blue' ? { x: 5, y: 4 } : { x: 6, y: 4 });
    }
  });

  it('breaks a voting tie by the order movement was issued, not creation order', () => {
    const e = blankEngine();
    const a = put(e, 'red', { x: 4, y: 4 }, sw(5));
    const b = put(e, 'red', { x: 6, y: 4 }, sw(5));
    a.moveOrder = 'e';
    b.moveOrder = 'w';
    a.moveSeq = 1;
    b.moveSeq = 0;
    runMovement(e);
    expect(b.pos).toEqual({ x: 5, y: 4 });
    expect(a.pos).toEqual({ x: 4, y: 4 });
  });

  it('joins friendly groups meeting in a square when they fit', () => {
    const e = blankEngine();
    const a = put(e, 'red', { x: 4, y: 4 }, sw(3));
    const b = put(e, 'red', { x: 6, y: 4 }, sw(4));
    a.moveOrder = 'e';
    b.moveOrder = 'w';
    runMovement(e);
    const here = groupsAt(e.state, { x: 5, y: 4 });
    expect(here).toHaveLength(1);
    expect(here[0].minionIds).toHaveLength(7);
    expect(Object.keys(e.state.groups)).toHaveLength(1);
  });

  it('bounces the later group when two friendly groups cannot join', () => {
    const e = blankEngine();
    const a = put(e, 'red', { x: 4, y: 4 }, sw(5));
    const b = put(e, 'red', { x: 6, y: 4 }, sw(5));
    a.moveOrder = 'e';
    b.moveOrder = 'w';
    runMovement(e);
    expect(a.pos).toEqual({ x: 5, y: 4 });
    expect(b.pos).toEqual({ x: 6, y: 4 });
  });

  it('lets a stationary group beat a mover that cannot join it', () => {
    const e = blankEngine();
    const s = put(e, 'red', { x: 5, y: 4 }, sw(5));
    const m = put(e, 'red', { x: 4, y: 4 }, sw(4));
    m.moveOrder = 'e';
    runMovement(e);
    expect(s.pos).toEqual({ x: 5, y: 4 });
    expect(m.pos).toEqual({ x: 4, y: 4 });
  });

  it('blocks on water unless every minion can swim', () => {
    const e = blankEngine();
    e.state.terrain['5,4'] = 'water';
    const a = put(e, 'red', { x: 4, y: 4 }, sw(1));
    const b = put(e, 'red', { x: 4, y: 6 }, sw(1));
    e.state.terrain['5,6'] = 'water';
    e.state.minions[b.minionIds[0]].base.walks.push('water');
    a.moveOrder = 'e';
    b.moveOrder = 'e';
    runMovement(e);
    expect(a.pos).toEqual({ x: 4, y: 4 });
    expect(b.pos).toEqual({ x: 5, y: 6 });
  });

  it('ignores move orders for neutral player-controlled groups', () => {
    const e = blankEngine();
    const n = put(e, 'neutral', { x: 4, y: 4 }, sw(1));
    n.moveOrder = 'e';
    runMovement(e);
    expect(n.pos).toEqual({ x: 4, y: 4 });
  });
});

describe('movement: structures and bots', () => {
  const east = defineCard({ id: 'east', name: 'East', house: 'war', cost: {}, type: 'summoning', target: 'square', bot: () => 'e' });
  const west = defineCard({ id: 'west', name: 'West', house: 'war', cost: {}, type: 'summoning', target: 'square', bot: () => 'w' });

  it('lets player-controlled recruits enter a town but not computer-controlled groups', () => {
    const e = gameEngine([east, west], [], { towns: 1 });
    const town = Object.values(e.state.structures).find((s) => s.kind === 'town')!;
    const player = put(e, 'red', { x: town.pos.x - 1, y: town.pos.y }, sw(1));
    player.moveOrder = 'e';
    const bot = createGroup(e, 'blue', { x: town.pos.x + 1, y: town.pos.y }, 'recruit', 'computer', 'west');
    spawnMinion(e, bot.id, recruitSpec('swordsman'));
    runMovement(e);
    expect(player.pos).toEqual(town.pos);
    expect(bot.pos).toEqual({ x: town.pos.x + 1, y: town.pos.y });
  });

  it('moves a computer-controlled group by its card bot', () => {
    const e = blankEngine([east]);
    const g = createGroup(e, 'neutral', { x: 4, y: 4 }, 'recruit', 'computer', 'east');
    spawnMinion(e, g.id, recruitSpec('swordsman'));
    runMovement(e);
    expect(g.pos).toEqual({ x: 5, y: 4 });
  });
});

describe('movement events', () => {
  it('fires exit, move, enter for groups that changed square', () => {
    const seen: string[] = [];
    const watcher = defineCard({
      id: 'watch', name: 'Watch', house: 'war', cost: {}, type: 'alteration', target: 'globe',
      on: {
        'group:exit': () => { seen.push('exit'); },
        'group:move': () => { seen.push('move'); },
        'group:enter': () => { seen.push('enter'); },
      },
    });
    const e = blankEngine([watcher]);
    addSpellRecord(e.state, { cardId: 'watch', owner: 'red', host: { kind: 'globe' }, visible: true, turnsLeft: null, tokens: {} });
    const mover = put(e, 'red', { x: 4, y: 4 }, sw(1));
    mover.moveOrder = 'e';
    runMovement(e);
    expect(seen).toEqual(['exit', 'move', 'enter']);
  });
});

describe('movement: the original moonwalk diagram', () => {
  it('bounces A, lets D take its square, and moonwalks A to the nearest free square', () => {
    const e = blankEngine();
    // squares: a=(4,4)  b=(3,4)  c=(3,5)  d=(4,5)
    // group sequence (= pass I order): D, A, C, B
    const D = put(e, 'red', { x: 4, y: 5 }, sw(5));
    const A = put(e, 'red', { x: 4, y: 4 }, sw(4));
    const C = put(e, 'red', { x: 3, y: 5 }, sw(5));
    const B = put(e, 'red', { x: 3, y: 4 }, sw(1));
    D.moveOrder = 'n'; // into a
    A.moveOrder = 'w'; // into b
    C.moveOrder = 'n'; // into b
    runMovement(e);
    expect(D.pos).toEqual({ x: 4, y: 4 });
    expect(e.state.groups[C.id]).toBeUndefined(); // C joined B
    expect(B.minionIds).toHaveLength(6);
    expect(B.pos).toEqual({ x: 3, y: 4 });
    expect(A.pos).not.toBeNull();
    expect(distance2(A.pos!, { x: 4, y: 4 })).toBe(1);
    expect(A.pos).toEqual({ x: 4, y: 3 });
    expect(groupsAt(e.state, A.pos!)).toHaveLength(1);
  });
});
