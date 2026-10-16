import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { addSpellRecord } from '../src/spellstore';
import { beginTurn } from '../src/turn';
import { gameEngine } from './helpers';

const gen = defineCard({
  id: 'gen', name: 'Gen', house: 'war', cost: {}, type: 'alteration', target: 'globe', exclusive: false,
  on: { 'mana:generate': (c) => { if (c.spell.owner !== 'neutral') c.addMana(c.spell.owner, 'will', 2); } },
});
const globe = { kind: 'globe' as const };

describe('mana:generate', () => {
  it('lets a spell add mana after the pools are reset', () => {
    const e = gameEngine([gen]);
    e.state.players.blue.mana.will = 9; // stale mana from last turn must not survive
    addSpellRecord(e.state, { cardId: 'gen', owner: 'blue', host: globe, visible: true, turnsLeft: null, tokens: {} });
    addSpellRecord(e.state, { cardId: 'gen', owner: 'blue', host: globe, visible: true, turnsLeft: null, tokens: {} });
    e.state.turn += 1;
    beginTurn(e, false);
    expect(e.state.players.blue.mana.will).toBe(4);
    expect(e.state.players.red.mana.will).toBe(0);
  });

  it('runs after town production', () => {
    const e = gameEngine([gen], [], { towns: 1 });
    const town = Object.values(e.state.structures).find((s) => s.kind === 'town')!;
    town.owner = 'red';
    town.manaType = 'strife';
    e.state.turn += 1;
    beginTurn(e, false);
    expect(e.state.players.red.mana.strife).toBe(1);
  });
});
