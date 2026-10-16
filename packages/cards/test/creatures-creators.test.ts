import { describe, expect, it } from 'vitest';
import { computeStats, fight, killMinion } from '@sanctum/engine/src/testing';
import { isHostMinion } from '../src/helpers';
import { card, Script, Target } from '../src/lang';
import { allCards } from '../src/index';
import { castMini, mini, put } from './lang-helpers';

const town = (id: number, owner: 'red' | 'blue', x: number, y: number) =>
  ({ id, kind: 'town' as const, pos: { x, y }, owner, manaType: null, novices: 0, turnCount: 2, captured: false });
const structure = (id: number) => ({ kind: 'structure' as const, id });

describe('Warlord', () => {
  it('creates a level 2 Human swordsman who leads his swordsmen', () => {
    const e = mini(allCards);
    e.state.structures[900] = town(900, 'red', 4, 4);
    const crew = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    expect(castMini(e, 'red', 'warlord', structure(900))).toBe('cast');
    const w = Object.values(e.state.minions).find((m) => m.name === 'Warlord')!;
    expect(w).toMatchObject({ nation: 'human', house: 'war', kind: 'recruit' });
    expect(w.base.level).toBe(2);
    expect(w.groupId).toBe(crew.id);
    const s = computeStats(e, w.id);
    expect([s.hand, s.armor, s.maxHp, s.level]).toEqual([5, 1, 7, 2]);
    expect(computeStats(e, crew.minionIds[0]).hand).toBe(3);
    expect(computeStats(e, crew.minionIds[1]).hand).toBe(0);
  });
  it('cannot be cast on another side\'s town', () => {
    const e = mini(allCards);
    e.state.structures[900] = town(900, 'blue', 4, 4);
    expect(castMini(e, 'red', 'warlord', structure(900))).toBe('squandered');
  });
});

describe('Bard', () => {
  it('joins a recruit group as an Elven swordsman who deals no damage and inspires the others', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    expect(castMini(e, 'red', 'bard', { kind: 'group', id: g.id })).toBe('cast');
    const bard = Object.values(e.state.minions).find((m) => m.name === 'Bard')!;
    expect(bard).toMatchObject({ nation: 'elf', house: 'life' });
    const s = computeStats(e, bard.id);
    expect([s.hand, s.armor, s.maxHp, s.level, s.handAttacks]).toEqual([0, 3, 7, 1, 0]);
    expect(computeStats(e, g.minionIds[0]).hand).toBe(3);
    expect(computeStats(e, g.minionIds[1]).hand).toBe(0);
  });
});

describe('Decoy', () => {
  it('is a taunting armored swordsman that deals no damage, one per group', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    expect(castMini(e, 'red', 'decoy', { kind: 'group', id: g.id })).toBe('cast');
    expect(castMini(e, 'red', 'decoy', { kind: 'group', id: g.id })).toBe('squandered');
    const d = Object.values(e.state.minions).find((m) => m.name === 'Decoy')!;
    const s = computeStats(e, d.id);
    expect([s.armor, s.noDamage, s.taunt]).toEqual([3, true, true]);
    expect(s.handAttacks).toBeLessThanOrEqual(0);
  });

  it("draws the enemy archer's fire", () => {
    // the archer dies in this fight and its spells go with it, so the probe records victims outside the state
    const victims: number[] = [];
    const probe = card({
      id: 'strike-probe', name: 'Probe', house: 'war', cost: {}, type: 'alteration', target: Target.recruit,
      keywords: [Script('probe', { on: { 'attacker:strikes': (c, ev) => { if (isHostMinion(c, ev)) victims.push(ev.data.victimId); } } })],
    });
    const e = mini([...allCards, probe]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    castMini(e, 'red', 'decoy', { kind: 'group', id: g.id });
    const d = Object.values(e.state.minions).find((m) => m.name === 'Decoy')!;
    const archer = put(e, 'blue', { x: 5, y: 4 }, ['archer']);
    castMini(e, 'blue', 'strike-probe', { kind: 'minion', id: archer.minionIds[0] });
    fight(e, g.id, archer.id);
    // every shot went to the Decoy, not to the swordsman
    expect(victims.length).toBeGreaterThan(0);
    expect(new Set(victims)).toEqual(new Set([d.id]));
  });
});

describe('Dragon\'s Teeth', () => {
  it('creates two level 1 swordsmen of random nations', () => {
    const e = mini(allCards);
    e.state.structures[900] = town(900, 'red', 4, 4);
    expect(castMini(e, 'red', 'dragons-teeth', structure(900))).toBe('cast');
    const ms = Object.values(e.state.minions);
    expect(ms).toHaveLength(2);
    for (const m of ms) {
      expect(m).toMatchObject({ kind: 'recruit', cls: 'swordsman' });
      expect(m.nation).not.toBeNull();
      expect(m.base.level).toBe(1);
    }
    expect(ms[0].groupId).toBe(ms[1].groupId);
  });
});

describe('Allies', () => {
  it('adds two Elf novices', () => {
    const e = mini(allCards);
    e.state.structures[900] = town(900, 'red', 4, 4);
    expect(castMini(e, 'red', 'allies', structure(900))).toBe('cast');
    expect(e.state.structures[900].novices).toBe(2);
    expect(e.state.structures[900].noviceNations).toEqual(['elf', 'elf']);
  });
});

describe('Incarnate', () => {
  const setup = () => {
    const e = mini(allCards);
    e.state.structures[1] = { id: 1, kind: 'sanctum', pos: { x: 2, y: 2 }, owner: 'red', manaType: null, novices: 0, turnCount: 2, captured: false };
    const g = put(e, 'red', { x: 5, y: 5 }, ['archer']);
    e.state.minions[g.minionIds[0]].nation = 'human';
    castMini(e, 'red', 'incarnate', { kind: 'minion', id: g.minionIds[0] });
    return { e, g };
  };
  it('creates a recruit of the same class and nation in the owner\'s Sanctum when the recruit dies', () => {
    const { e, g } = setup();
    killMinion(e, g.minionIds[0], null, 'dies');
    const fresh = Object.values(e.state.minions).filter((m) => m.status === 'alive');
    expect(fresh).toHaveLength(1);
    expect(fresh[0]).toMatchObject({ cls: 'archer', owner: 'red' });
    expect(e.state.groups[fresh[0].groupId].pos).toEqual({ x: 2, y: 2 });
  });
  it('is lost when the Sanctum is blocked', () => {
    const { e, g } = setup();
    put(e, 'blue', { x: 2, y: 2 }, ['swordsman']);
    killMinion(e, g.minionIds[0], null, 'dies');
    expect(Object.values(e.state.minions).filter((m) => m.status === 'alive' && m.owner === 'red')).toHaveLength(0);
  });
});
