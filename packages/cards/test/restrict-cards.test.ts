import { describe, it, expect } from 'vitest';
import { expireSpells } from '@sanctum/engine/src/testing';
import { advance, cast, gref, mref, put, stats, world } from './helpers';

const globe = { kind: 'globe' as const };
const town = {
  id: 900, kind: 'town' as const, pos: { x: 8, y: 2 }, owner: 'red' as const, manaType: null, novices: 0, turnCount: 2, captured: false,
};
const expire = (e: ReturnType<typeof world>, n: number) => { for (let i = 0; i < n; i++) expireSpells(e); };

describe("Adriel's Glamour", () => {
  it('blocks globe spells for both players until it expires', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(cast(e, 'red', 'adriels-glamour', globe)).toBe('cast');
    expect(cast(e, 'blue', 'aura-of-world', globe)).toBe('squandered');
    expect(cast(e, 'red', 'war-drums', gref(g.id))).toBe('cast');
    expire(e, 5);
    expect(cast(e, 'blue', 'aura-of-world', globe)).toBe('cast');
  });
});

describe("Adriel's Promise", () => {
  it('blocks structure spells', () => {
    const e = world();
    e.state.structures[900] = town;
    expect(cast(e, 'red', 'adriels-promise', globe)).toBe('cast');
    expect(cast(e, 'red', 'oasis', { kind: 'structure', id: 900 })).toBe('squandered');
  });
});

describe('Individualism', () => {
  it('blocks group spells but not individual spells', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(cast(e, 'red', 'individualism', globe)).toBe('cast');
    expect(cast(e, 'red', 'ngozis-way', gref(g.id))).toBe('squandered');
    expect(cast(e, 'red', 'flaming-sword', mref(g.minionIds[0]))).toBe('cast');
  });
});

describe("Adriel's Mantle", () => {
  it('shields the group and its members, only the group, for two turns', () => {
    const e = world();
    const shielded = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const other = put(e, 'blue', { x: 6, y: 6 }, ['swordsman']);
    const id = shielded.minionIds[0];
    expect(cast(e, 'red', 'adriels-mantle', gref(shielded.id))).toBe('cast');
    expect(cast(e, 'blue', 'ngozis-way', gref(shielded.id))).toBe('squandered');
    expect(cast(e, 'blue', 'flaming-sword', mref(id))).toBe('squandered');
    expect(cast(e, 'red', 'ngozis-way', gref(other.id))).toBe('cast');
    expire(e, 2);
    expect(cast(e, 'blue', 'ngozis-way', gref(shielded.id))).toBe('cast');
  });
});

describe('Seelie Favor', () => {
  it('shields an enemy group from group spells only', () => {
    const e = world();
    const mine = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const theirs = put(e, 'blue', { x: 6, y: 6 }, ['swordsman']);
    expect(cast(e, 'red', 'seelie-favor', gref(mine.id))).toBe('squandered');
    expect(cast(e, 'red', 'seelie-favor', gref(theirs.id))).toBe('cast');
    expect(cast(e, 'red', 'ngozis-way', gref(theirs.id))).toBe('squandered');
    expect(cast(e, 'red', 'flaming-sword', mref(theirs.minionIds[0]))).toBe('cast');
  });
});

describe('Fog of War', () => {
  it('blocks individual spells on all minions, not group spells', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(cast(e, 'red', 'fog-of-war', globe)).toBe('cast');
    expect(cast(e, 'red', 'flaming-sword', mref(g.minionIds[0]))).toBe('squandered');
    expect(cast(e, 'red', 'ngozis-way', gref(g.id))).toBe('cast');
  });
});

describe('Court Politics', () => {
  it('stops the caster using spells on friends, then pays +2 Clarity after expiry', () => {
    const e = world();
    const mine = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const theirs = put(e, 'blue', { x: 6, y: 6 }, ['swordsman']);
    expect(cast(e, 'red', 'court-politics', globe)).toBe('cast');
    expect(cast(e, 'red', 'ngozis-way', gref(mine.id))).toBe('squandered');
    expect(cast(e, 'red', 'flaming-sword', mref(mine.minionIds[0]))).toBe('squandered');
    expect(cast(e, 'red', 'ngozis-way', gref(theirs.id))).toBe('cast');
    expect(cast(e, 'blue', 'war-drums', gref(theirs.id))).toBe('cast');
    expire(e, 3);
    expect(e.state.spells.map((s) => s.cardId)).toContain('court-politics-ii');
    expect(e.state.spells.map((s) => s.cardId)).not.toContain('court-politics');
    advance(e);
    expect(e.state.players.red.mana.clarity).toBe(2);
    expect(e.state.players.blue.mana.clarity).toBe(0);
    expect(cast(e, 'red', 'ngozis-way', gref(mine.id))).toBe('cast');
  });
});

describe('Lone Wolf', () => {
  it('buffs a swordsman alone in its group and shields it from friendly spells', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const id = g.minionIds[0];
    expect(cast(e, 'red', 'lone-wolf', mref(id))).toBe('cast');
    const st = stats(e, id);
    expect([st.hand, st.armor, st.maxHp]).toEqual([5, 2, 13]);
    expect(e.state.minions[id].hp).toBe(13);
    expect(cast(e, 'red', 'flaming-sword', mref(id))).toBe('squandered');
    expect(cast(e, 'red', 'ngozis-way', gref(g.id))).toBe('squandered');
    expect(cast(e, 'blue', 'flaming-sword', mref(id))).toBe('cast');
  });
  it('protects the swordsman from spells cast by its OWNER, whoever cast the wolf', () => {
    const e = world();
    const g = put(e, 'blue', { x: 4, y: 4 }, ['swordsman']);
    const id = g.minionIds[0];
    expect(cast(e, 'red', 'lone-wolf', mref(id))).toBe('cast');
    expect(cast(e, 'blue', 'flaming-sword', mref(id))).toBe('squandered');
    expect(cast(e, 'blue', 'ngozis-way', gref(g.id))).toBe('squandered');
    expect(cast(e, 'red', 'flaming-sword', mref(id))).toBe('cast');
  });
  it('needs a swordsman alone in its group', () => {
    const e = world();
    const pair = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman']);
    const archer = put(e, 'red', { x: 6, y: 6 }, ['archer']);
    expect(cast(e, 'red', 'lone-wolf', mref(pair.minionIds[0]))).toBe('squandered');
    expect(cast(e, 'red', 'lone-wolf', mref(archer.minionIds[0]))).toBe('squandered');
  });
});
