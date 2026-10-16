import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { fight, runCombats } from '../src/combat';
import { addSpellRecord } from '../src/spellstore';
import { blankEngine, put } from './helpers';

type Cls = 'swordsman' | 'archer';

function duel(a: Cls[], b: Cls[], init: 'red' | 'blue' = 'red') {
  const e = blankEngine();
  e.state.initiative = init;
  const ga = put(e, 'red', { x: 4, y: 4 }, a);
  const gb = put(e, 'blue', { x: 5, y: 4 }, b);
  return { e, ga, gb };
}

describe('fight', () => {
  it('swordsman duel: the first-striking group wins with 1 hp', () => {
    const { e, ga, gb } = duel(['swordsman'], ['swordsman']);
    const winner = e.state.minions[ga.minionIds[0]];
    fight(e, ga.id, gb.id);
    expect(e.state.groups[gb.id]).toBeUndefined();
    expect(winner.status).toBe('alive');
    expect(winner.hp).toBe(1);
    expect(winner.expQualified).toBe(true);
  });

  it('archer duel: round 1 volley at -1, winner left with 2 hp', () => {
    const { e, ga, gb } = duel(['archer'], ['archer']);
    const winner = e.state.minions[ga.minionIds[0]];
    fight(e, ga.id, gb.id);
    expect(e.state.groups[gb.id]).toBeUndefined();
    expect(winner.hp).toBe(2);
  });

  it('a level-0 attacker misses every other attack against a level-1 victim', () => {
    const { e, ga, gb } = duel(['archer'], ['archer']);
    e.state.minions[ga.minionIds[0]].base.level = 0;
    const lo = e.state.minions[gb.minionIds[0]];
    fight(e, ga.id, gb.id);
    expect(e.state.groups[ga.id]).toBeUndefined();
    expect(lo.hp).toBe(4);
  });

  it('a group of two archers beats a lone archer', () => {
    const { e, ga, gb } = duel(['archer', 'archer'], ['archer']);
    fight(e, ga.id, gb.id);
    expect(e.state.groups[gb.id]).toBeUndefined();
    const hp = ga.minionIds.map((id) => e.state.minions[id].hp).reduce((a, b) => a + b, 0);
    expect(hp).toBe(11);
  });

  it('fires combat events in order', () => {
    const seen: string[] = [];
    const log = defineCard({
      id: 'log', name: 'Log', house: 'war', cost: {}, type: 'alteration', target: 'globe',
      on: {
        'combat:start': () => { seen.push('start'); },
        'round:start': () => { seen.push('round'); },
        'combat:end': () => { seen.push('end'); },
        'combat:after': () => { seen.push('after'); },
      },
    });
    const e = blankEngine([log]);
    addSpellRecord(e.state, { cardId: 'log', owner: 'red', host: { kind: 'globe' }, visible: true, turnsLeft: null, tokens: {} });
    const ga = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    const gb = put(e, 'blue', { x: 5, y: 4 }, ['archer']);
    fight(e, ga.id, gb.id);
    expect(seen.slice(0, 2)).toEqual(['start', 'start']);
    expect(seen.filter((x) => x === 'round')).toHaveLength(8);
    expect(seen.slice(-2)).toEqual(['end', 'after']);
  });
});

describe('runCombats', () => {
  it('gives precedence to the initiative player', () => {
    for (const init of ['red', 'blue'] as const) {
      const { e, ga, gb } = duel(['swordsman'], ['swordsman'], init);
      runCombats(e);
      const winner = init === 'red' ? ga : gb;
      const loser = init === 'red' ? gb : ga;
      expect(e.state.groups[loser.id]).toBeUndefined();
      expect(e.state.minions[winner.minionIds[0]].hp).toBe(1);
    }
  });

  it('does not fight at range or between friends', () => {
    const e = blankEngine();
    const a = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const far = put(e, 'blue', { x: 6, y: 4 }, ['swordsman']);
    const friend = put(e, 'red', { x: 4, y: 5 }, ['swordsman']);
    runCombats(e);
    for (const g of [a, far, friend]) expect(e.state.minions[g.minionIds[0]].hp).toBe(7);
  });

  it('fights each adjacent hostile pair once', () => {
    const e = blankEngine();
    e.state.initiative = 'red';
    const mid = put(e, 'red', { x: 4, y: 4 }, ['archer', 'archer', 'archer', 'archer']);
    const left = put(e, 'blue', { x: 3, y: 4 }, ['archer']);
    const right = put(e, 'blue', { x: 5, y: 4 }, ['archer']);
    runCombats(e);
    expect(e.state.groups[left.id]).toBeUndefined();
    expect(e.state.groups[right.id]).toBeUndefined();
    expect(e.state.groups[mid.id]).toBeDefined();
  });
});
