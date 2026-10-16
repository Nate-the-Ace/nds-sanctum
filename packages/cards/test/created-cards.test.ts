import { describe, it, expect } from 'vitest';
import { dispatch, expireSpells } from '@sanctum/engine/src/testing';
import { cast, mref, put, world } from './helpers';

const structure = { kind: 'structure' as const, id: 900 };
const town = {
  id: 900, kind: 'town' as const, pos: { x: 4, y: 4 }, owner: 'red' as const, manaType: null, novices: 0, turnCount: 2, captured: false,
};

describe('Clandestine', () => {
  it('conceals recruits created in the town, for the casting turn plus four', () => {
    const e = world();
    e.state.structures[900] = town;
    expect(cast(e, 'red', 'clandestine', structure)).toBe('cast');
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    dispatch(e, 'minion:created', structure, { minionId: id });
    expect(e.state.spells.filter((s) => s.cardId === 'greymantle')).toHaveLength(1);
    expect(cast(e, 'blue', 'flaming-sword', mref(id))).toBe('squandered');
    expect(cast(e, 'red', 'flaming-sword', mref(id))).toBe('cast');
    for (let i = 0; i < 5; i++) expireSpells(e);
    expect(e.state.spells.some((s) => s.cardId === 'clandestine')).toBe(false);
  });
});

describe("Auberol's Grace", () => {
  it('gives recruits created in the town +4 maximum and current hit points', () => {
    const e = world();
    e.state.structures[900] = town;
    expect(cast(e, 'red', 'auberols-grace', structure)).toBe('cast');
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    dispatch(e, 'minion:created', structure, { minionId: id });
    expect(e.state.minions[id].maxHp).toBe(11);
    expect(e.state.minions[id].hp).toBe(11);
  });
});
