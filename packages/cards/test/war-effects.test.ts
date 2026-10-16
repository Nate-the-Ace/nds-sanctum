import { describe, it, expect } from 'vitest';
import { dispatch, fight } from '@sanctum/engine/src/testing';
import { cast, gref, mref, put, putMonster, sref, stats, world } from './helpers';

describe('Fireball', () => {
  it('deals 5 magical damage to every member', () => {
    const e = world();
    const g = put(e, 'blue', { x: 4, y: 4 }, ['swordsman', 'swordsman']);
    const ids = [...g.minionIds];
    expect(cast(e, 'red', 'fireball', gref(g.id))).toBe('cast');
    for (const id of ids) expect(e.state.minions[id].hp).toBe(2);
  });
  it('kills and removes a group it destroys', () => {
    const e = world();
    const g = put(e, 'blue', { x: 4, y: 4 }, ['archer']);
    const id = g.minionIds[0];
    e.state.minions[id].hp = 4;
    cast(e, 'red', 'fireball', gref(g.id));
    expect(e.state.minions[id].status).toBe('dead');
    expect(e.state.groups[g.id]).toBeUndefined();
  });
});

describe('Good of the Many', () => {
  it('kills a friendly recruit but not an enemy one', () => {
    const e = world();
    const mine = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    const theirs = put(e, 'blue', { x: 6, y: 6 }, ['swordsman']).minionIds[0];
    expect(cast(e, 'red', 'good-of-the-many', mref(theirs))).toBe('squandered');
    expect(e.state.minions[theirs].status).toBe('alive');
    expect(cast(e, 'red', 'good-of-the-many', mref(mine))).toBe('cast');
    expect(e.state.minions[mine].status).toBe('dead');
  });
});

describe('Plains and Volcano', () => {
  it('Plains turns an empty square to plains', () => {
    const e = world();
    e.state.terrain['5,5'] = 'forest';
    expect(cast(e, 'red', 'plains', sref(5, 5))).toBe('cast');
    expect(e.state.terrain['5,5']).toBe('plains');
  });
  it('Plains squanders on an occupied square', () => {
    const e = world();
    e.state.terrain['5,5'] = 'forest';
    put(e, 'blue', { x: 5, y: 5 }, ['swordsman']);
    expect(cast(e, 'red', 'plains', sref(5, 5))).toBe('squandered');
    expect(e.state.terrain['5,5']).toBe('forest');
  });
  it('Volcano turns an empty square to volcano', () => {
    const e = world();
    expect(cast(e, 'red', 'volcano', sref(5, 5))).toBe('cast');
    expect(e.state.terrain['5,5']).toBe('volcano');
  });
});

describe('Scorched Earth', () => {
  it('burns the whole contiguous forest', () => {
    const e = world();
    for (const k of ['4,4', '5,4', '4,5', '8,2']) e.state.terrain[k] = 'forest';
    expect(cast(e, 'red', 'scorched-earth', sref(4, 4))).toBe('cast');
    for (const k of ['4,4', '5,4', '4,5']) expect(e.state.terrain[k]).toBe('barren');
    expect(e.state.terrain['8,2']).toBe('forest');
  });
  it('needs a forest square', () => {
    const e = world();
    expect(cast(e, 'red', 'scorched-earth', sref(6, 6))).toBe('squandered');
  });
});

describe('Dragon Slayer', () => {
  it('kills a monster the archer damages', () => {
    const e = world();
    const a = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    const mon = putMonster(e, 'blue', { x: 5, y: 4 });
    expect(cast(e, 'red', 'dragon-slayer', mref(a.minionIds[0]))).toBe('cast');
    fight(e, a.id, mon.id);
    expect(e.state.groups[mon.id]).toBeUndefined();
  });
  it('cannot target a swordsman', () => {
    const e = world();
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    expect(cast(e, 'red', 'dragon-slayer', mref(id))).toBe('squandered');
  });
});

describe('Berserker Blade', () => {
  it('adds +1 hand damage per hit taken and resets after combat', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const id = g.minionIds[0];
    expect(cast(e, 'red', 'berserker-blade', mref(id))).toBe('cast');
    expect(stats(e, id).hand).toBe(2);
    dispatch(e, 'attack:hit', mref(id), {});
    dispatch(e, 'attack:hit', mref(id), {});
    expect(stats(e, id).hand).toBe(4);
    dispatch(e, 'combat:end', gref(g.id), {});
    expect(stats(e, id).hand).toBe(2);
  });
});

describe('Berserkers', () => {
  it('adds +1 hand per combat casualty, max +3, reset at end of combat', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman', 'swordsman']);
    const [dying, other] = g.minionIds;
    expect(cast(e, 'red', 'berserkers', gref(g.id))).toBe('cast');
    dispatch(e, 'minion:dies', mref(dying), { blame: 99 });
    expect(stats(e, other).hand).toBe(3);
    dispatch(e, 'minion:dies', mref(dying), { blame: null });
    expect(stats(e, other).hand).toBe(3);
    for (let i = 0; i < 4; i++) dispatch(e, 'minion:dies', mref(dying), { blame: 99 });
    expect(stats(e, other).hand).toBe(5);
    dispatch(e, 'combat:end', gref(g.id), {});
    expect(stats(e, other).hand).toBe(2);
  });
});

describe('Rain of Arrows', () => {
  it('gives archers +1 attack and is dispelled after the next combat', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['archer', 'swordsman']);
    const [ar, sw] = g.minionIds;
    expect(cast(e, 'red', 'rain-of-arrows', gref(g.id))).toBe('cast');
    expect(stats(e, ar).missileAttacks).toBe(2);
    expect(stats(e, sw).missileAttacks).toBe(0);
    dispatch(e, 'combat:after', gref(g.id), {});
    expect(e.state.spells).toHaveLength(0);
    expect(stats(e, ar).missileAttacks).toBe(1);
  });
  it('needs an archer in the group', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(cast(e, 'red', 'rain-of-arrows', gref(g.id))).toBe('squandered');
  });
});

describe('Shattering Blow', () => {
  it('kills the first thing it hits, then weakens the sword', () => {
    const e = world();
    const red = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const blue = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']);
    const id = red.minionIds[0];
    expect(cast(e, 'red', 'shattering-blow', mref(id))).toBe('cast');
    fight(e, red.id, blue.id);
    expect(e.state.groups[blue.id]).toBeUndefined();
    expect(e.state.minions[id].hp).toBe(7);
    expect(stats(e, id).hand).toBe(1);
  });
});
