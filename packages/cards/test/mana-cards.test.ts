import { describe, it, expect } from 'vitest';
import { advance, cast, world } from './helpers';

const globe = { kind: 'globe' as const };
const town = (owner: 'red' | 'blue' | 'neutral') => ({
  id: 900, kind: 'town' as const, pos: { x: 4, y: 4 }, owner, manaType: null, novices: 0, turnCount: 2, captured: false,
});

describe('Point of Clarity and Aura of World', () => {
  it('give +1 Clarity / +1 World each turn and stack', () => {
    const e = world();
    expect(cast(e, 'red', 'point-of-clarity', globe)).toBe('cast');
    expect(cast(e, 'red', 'point-of-clarity', globe)).toBe('cast');
    expect(cast(e, 'red', 'aura-of-world', globe)).toBe('cast');
    advance(e);
    expect(e.state.players.red.mana.clarity).toBe(2);
    expect(e.state.players.red.mana.world).toBe(1);
    expect(e.state.players.blue.mana.clarity).toBe(0);
    advance(e);
    expect(e.state.players.red.mana.clarity).toBe(2);
  });
});

describe('Call to Arms and Ring of Light', () => {
  it('pay +2 mana to whoever owns the town', () => {
    const e = world();
    e.state.structures[900] = town('red');
    expect(cast(e, 'red', 'call-to-arms', { kind: 'structure', id: 900 })).toBe('cast');
    expect(cast(e, 'red', 'ring-of-light', { kind: 'structure', id: 900 })).toBe('cast');
    advance(e);
    expect(e.state.players.red.mana.strife).toBe(2);
    expect(e.state.players.red.mana.clarity).toBe(2);
    e.state.structures[900].owner = 'blue';
    advance(e);
    expect(e.state.players.blue.mana.strife).toBe(2);
    expect(e.state.players.red.mana.strife).toBe(0);
  });

  it('pay nothing while the town is neutral', () => {
    const e = world();
    e.state.structures[900] = town('neutral');
    cast(e, 'red', 'call-to-arms', { kind: 'structure', id: 900 });
    advance(e);
    expect(e.state.players.red.mana.strife).toBe(0);
    expect(e.state.players.blue.mana.strife).toBe(0);
  });
});
