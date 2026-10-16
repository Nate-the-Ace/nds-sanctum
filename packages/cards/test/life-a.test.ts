import { describe, it, expect } from 'vitest';
import { dispatch } from '@sanctum/engine/src/testing';
import { advance, cast, gref, mref, put, sref, stats, world } from './helpers';

describe('Caravan', () => {
  it('stops desert damage', () => {
    const e = world();
    e.state.terrain['4,4'] = 'desert';
    e.state.terrain['6,6'] = 'desert';
    const a = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const b = put(e, 'red', { x: 6, y: 6 }, ['swordsman']);
    const [ida, idb] = [a.minionIds[0], b.minionIds[0]];
    expect(cast(e, 'red', 'caravan', gref(a.id))).toBe('cast');
    advance(e);
    expect(e.state.minions[ida].hp).toBe(7);
    expect(e.state.minions[idb].hp).toBe(6);
  });
});

describe('Flight', () => {
  it('lets a group survive water', () => {
    const e = world();
    e.state.terrain['4,4'] = 'water';
    e.state.terrain['6,6'] = 'water';
    const a = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const b = put(e, 'red', { x: 6, y: 6 }, ['swordsman']);
    const [ida, idb] = [a.minionIds[0], b.minionIds[0]];
    expect(cast(e, 'red', 'flight', gref(a.id))).toBe('cast');
    advance(e);
    expect(e.state.minions[ida].status).toBe('alive');
    expect(e.state.minions[idb].status).toBe('dead');
  });
});

describe('Cleansing Light', () => {
  it('dispels group and individual spells on the group', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    cast(e, 'red', 'flaming-sword', mref(g.minionIds[0]));
    cast(e, 'red', 'ngozis-way', gref(g.id));
    expect(e.state.spells).toHaveLength(2);
    expect(cast(e, 'blue', 'cleansing-light', gref(g.id))).toBe('cast');
    expect(e.state.spells).toHaveLength(0);
  });
  it('leaves spells on other groups alone', () => {
    const e = world();
    const a = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const b = put(e, 'red', { x: 6, y: 6 }, ['swordsman']);
    cast(e, 'red', 'ngozis-way', gref(b.id));
    cast(e, 'blue', 'cleansing-light', gref(a.id));
    expect(e.state.spells).toHaveLength(1);
  });
});

describe('Pyx', () => {
  it('fully heals the group', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    const ids = [...g.minionIds];
    e.state.minions[ids[0]].hp = 2;
    e.state.minions[ids[1]].hp = 5;
    expect(cast(e, 'red', 'pyx', gref(g.id))).toBe('cast');
    for (const id of ids) expect(e.state.minions[id].hp).toBe(7);
  });
});

describe('Healing Hands', () => {
  it('heals every member of the target group by 1 at start of turn', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman']);
    const [hurt, healthy] = g.minionIds;
    e.state.minions[hurt].hp = 3;
    expect(cast(e, 'red', 'healing-hands', mref(healthy))).toBe('cast');
    advance(e);
    expect(e.state.minions[hurt].hp).toBe(4);
    expect(e.state.minions[healthy].hp).toBe(7);
  });
});

describe('Oasis', () => {
  it('turns the four neighbours to desert and heals recruits in the town', () => {
    const e = world();
    e.state.structures[900] = {
      id: 900, kind: 'town', pos: { x: 4, y: 4 }, owner: 'red', manaType: null, novices: 0, turnCount: 2, captured: false,
    };
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const id = g.minionIds[0];
    e.state.minions[id].hp = 5;
    expect(cast(e, 'red', 'oasis', { kind: 'structure', id: 900 })).toBe('cast');
    for (const k of ['5,4', '3,4', '4,3', '4,5']) expect(e.state.terrain[k]).toBe('desert');
    expect(e.state.terrain['4,4']).toBe('plains');
    advance(e);
    expect(e.state.minions[id].hp).toBe(6);
  });
});

describe('Wellspring', () => {
  it('heals every minion on the board when a recruit group enters, then vanishes', () => {
    const e = world();
    const red = put(e, 'red', { x: 3, y: 3 }, ['swordsman']);
    const blue = put(e, 'blue', { x: 8, y: 8 }, ['archer']);
    const [idr, idb] = [red.minionIds[0], blue.minionIds[0]];
    e.state.minions[idr].hp = 4;
    e.state.minions[idb].hp = 3;
    expect(cast(e, 'red', 'wellspring', sref(5, 5))).toBe('cast');
    expect(e.state.spells).toHaveLength(1);
    const mover = put(e, 'red', { x: 5, y: 5 }, ['swordsman']);
    dispatch(e, 'group:enter', gref(mover.id), {});
    expect(e.state.minions[idr].hp).toBe(7);
    expect(e.state.minions[idb].hp).toBe(7);
    expect(e.state.spells).toHaveLength(0);
  });
});

describe('stats sanity', () => {
  it('Caravan grants the desert walk', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const id = g.minionIds[0];
    cast(e, 'red', 'caravan', gref(g.id));
    expect(stats(e, id).walks).toContain('desert');
  });
});
