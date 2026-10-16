import { describe, expect, it } from 'vitest';
import { computeStats, fight, killMinion } from '@sanctum/engine/src/testing';
import { hasEnchantments, isHostMinion } from '../src/helpers';
import { Aura, card, faceOf, Grant, Script, Target } from '../src/lang';
import { allCards } from '../src/index';
import { castMini, mini, put } from './lang-helpers';

const sq = (x: number, y: number) => ({ kind: 'square' as const, pos: { x, y } });
const grp = (id: number) => ({ kind: 'group' as const, id });
const named = (e: ReturnType<typeof mini>, name: string) => Object.values(e.state.minions).find((m) => m.name === name)!;

describe('identity helpers are undispellable', () => {
  it('Cleansing Light on a group with a Decoy keeps its armor and taunt', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(castMini(e, 'red', 'decoy', grp(g.id))).toBe('cast');
    const d = named(e, 'Decoy');
    expect(castMini(e, 'blue', 'cleansing-light', grp(g.id))).toBe('cast');
    const s = computeStats(e, d.id);
    expect([s.armor, s.taunt, s.noDamage]).toEqual([3, true, true]);
  });
  it('the helpers are not enchantments (Warded counts only visible spells)', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    castMini(e, 'red', 'decoy', grp(g.id));
    castMini(e, 'red', 'bard', grp(g.id));
    const q = { state: e.state } as Parameters<typeof hasEnchantments>[0];
    expect(hasEnchantments(q, named(e, 'Decoy'))).toBe(false);
    expect(hasEnchantments(q, named(e, 'Bard'))).toBe(false);
  });
  it('Warlord, Ngozi and Lienna keep their helpers through Cleansing Light', () => {
    for (const helper of ['warlord-command', 'bard-song', 'ngozis-blight', 'liennas-presence', 'decoy-ruse']) {
      expect(allCards.find((c) => c.id === helper)!.visible).toBe(false);
    }
  });
});

describe('Monster terrain', () => {
  it('a Hellion cannot be summoned where it cannot stand', () => {
    for (const t of ['water', 'mountain', 'volcano'] as const) {
      const e = mini(allCards);
      e.state.terrain['5,5'] = t;
      expect(castMini(e, 'red', 'hellion', sq(5, 5))).toBe('squandered');
    }
  });
  it('walkers still summon on their terrain', () => {
    for (const [id, t] of [['salamander', 'lava'], ['wyrmling', 'volcano'], ['undine', 'water']] as const) {
      const e = mini(allCards);
      e.state.terrain['5,5'] = t;
      expect(castMini(e, 'red', id, sq(5, 5)), id).toBe('cast');
    }
  });
});

describe('Taunt binds extra attacks', () => {
  it('a two-shot archer spends every shot on the Decoy', () => {
    const victims: number[] = [];
    const probe = card({
      id: 'strike-probe-2', name: 'Probe', house: 'war', cost: {}, type: 'alteration', target: Target.recruit,
      keywords: [Script('probe', { on: { 'attacker:strikes': (c, ev) => { if (isHostMinion(c, ev)) victims.push(ev.data.victimId); } } })],
    });
    const e = mini([...allCards, probe]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman', 'swordsman']);
    castMini(e, 'red', 'decoy', grp(g.id));
    const d = named(e, 'Decoy');
    d.base.hp = 999; // the Decoy outlives the fight
    d.hp = 999;
    const archer = put(e, 'blue', { x: 5, y: 4 }, ['archer']);
    // a sturdy two-shot archer, so the fight lasts several rounds and many extra shots are fired
    Object.assign(e.state.minions[archer.minionIds[0]].base, { missileAttacks: 2, armor: 9, hp: 99 });
    e.state.minions[archer.minionIds[0]].hp = 99;
    castMini(e, 'blue', 'strike-probe-2', { kind: 'minion', id: archer.minionIds[0] });
    fight(e, g.id, archer.id);
    expect(victims.length).toBeGreaterThan(4);
    expect(new Set(victims)).toEqual(new Set([d.id]));
  });
});

describe('Create terrain', () => {
  it('a Bard cannot join a group standing on water', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    e.state.terrain['4,4'] = 'water';
    expect(castMini(e, 'red', 'bard', grp(g.id))).toBe('squandered');
  });
  it('but can join a flying group over water', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(castMini(e, 'red', 'flight', grp(g.id))).toBe('cast');
    e.state.terrain['4,4'] = 'water';
    expect(castMini(e, 'red', 'bard', grp(g.id))).toBe('cast');
  });
});

describe('Aura declaration', () => {
  it('rejects a card whose other keywords also contribute stats', () => {
    expect(() => card({
      id: 'bad-aura', name: 'Bad Aura', house: 'war', cost: {}, type: 'alteration', helper: true, target: Target.recruit,
      keywords: [Aura({ hand: 1 }), Grant({ armor: 2 })],
    })).toThrow(/Aura/);
  });
});

describe('Incarnate in a full Sanctum group', () => {
  it('re-creates the recruit when the dying host was the eighth member', () => {
    const e = mini(allCards);
    e.state.structures[1] = { id: 1, kind: 'sanctum', pos: { x: 2, y: 2 }, owner: 'red', manaType: null, novices: 0, turnCount: 2, captured: false };
    const g = put(e, 'red', { x: 2, y: 2 }, Array(8).fill('archer'));
    const host = g.minionIds[3];
    castMini(e, 'red', 'incarnate', { kind: 'minion', id: host });
    killMinion(e, host, null, 'dies');
    const alive = Object.values(e.state.minions).filter((m) => m.status === 'alive' && m.owner === 'red');
    expect(alive).toHaveLength(8);
  });
});

describe('Wyrmling Hide', () => {
  it('does not stack when one group kills two Wyrmlings', () => {
    const e = mini(allCards);
    e.state.terrain['5,5'] = 'volcano';
    e.state.terrain['8,2'] = 'volcano';
    castMini(e, 'red', 'wyrmling', sq(5, 5));
    castMini(e, 'red', 'wyrmling', sq(8, 2));
    const [a, b] = Object.values(e.state.groups).filter((g) => g.kind === 'monster');
    const killers = put(e, 'red', { x: 3, y: 3 }, ['swordsman']);
    killMinion(e, a.minionIds[0], killers.minionIds[0], 'kills');
    killMinion(e, b.minionIds[0], killers.minionIds[0], 'kills');
    expect(e.state.spells.filter((s) => s.cardId === 'wyrmling-hide')).toHaveLength(1);
    expect(computeStats(e, killers.minionIds[0]).armor).toBe(3);
  });
});

describe('creature faces print final stats', () => {
  const line = (id: string, i: number) => faceOf(id)!.lines[i];
  it('folds helper stats into the stat line', () => {
    expect(line('warlord', 1)).toMatch(/^Create Warlord \(H:5 A:1 HP:7 L:2\) with Warlord Command/);
    expect(line('decoy', 1)).toMatch(/^Create Decoy \(H:0 A:3 HP:7 L:1\) with Decoy Ruse/);
    expect(line('vlad-hrothgar', 2)).toMatch(/^Create Vlad Hrothgar \(H:3 A:2 HP:11 L:2\)/);
    expect(line('vlad-hrothgar', 3)).toMatch(/^Create Oro \(H:3 A:1 HP:13 L:2\)/);
    expect(line('dragons-teeth', 1)).toBe('Create 2 swordsmen (H:2 A:1 HP:* L:1, random nations).');
  });
  it('prints the creature line before behaviour and trigger lines', () => {
    expect(faceOf('brimstone-dragon')!.lines).toEqual([
      'Mountain or volcano square.', 'Territorial.', 'Summon Brimstone Dragon (H:4 A:1 HP:16 L:2, Flight).',
      'Start of combat: Deal 5 damage to the opposing group.',
    ]);
    expect(faceOf('arboriads')!.lines[2]).toMatch(/^Summon 2 Arboriads/);
  });
});
