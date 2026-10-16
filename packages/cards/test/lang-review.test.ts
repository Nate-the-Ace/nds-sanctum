import { describe, it, expect } from 'vitest';
import type { EventContext, GameEvent } from '@sanctum/engine';
import { computeStats, dispatch } from '@sanctum/engine/src/testing';
import {
  Afterward, card, Fleeting, Forbid, Give, glossary, Grant, Lasts, mergeFragments, On, OnCast, printEffect, Ramp,
  Target, Truce, Warded, When, Withdraw, Kill, Heal,
} from '../src/lang';
import { castMini, mini, put } from './lang-helpers';

const base = { house: 'war' as const, cost: {}, type: 'alteration' as const };

describe('review fixes: printing', () => {
  it('M1: Grant glossary makes no heal claim; heal:true prints the heal', () => {
    const g = glossary().find((e) => e.kind === 'grant')!;
    expect(g.gloss).toMatch(/\+N HP raises maximum hit points/);
    expect(g.gloss).not.toMatch(/also heals/);
    const d = card({ id: 'rv-heal', name: 'H', ...base, target: Target.recruit, keywords: [Grant({ hand: 1, maxHp: 4 }, { heal: true })] });
    expect(d.text).toBe('Recruit.\n+1 H, +4 HP (heals 4).');
  });

  it('M2: Give once says "once each"', () => {
    card({ id: 'rv-mark', name: 'Mark', ...base, helper: true, target: Target.recruit, keywords: [Grant({ armor: 1 })] });
    expect(printEffect(Give('rv-mark', 'enterer', true))).toContain('once each');
    expect(printEffect(Give('rv-mark', 'enterer'))).not.toContain('once');
  });

  it('L3: Forbid prints "friends" without the Caster: part', () => {
    const d = card({ id: 'rv-forbid', name: 'F', ...base, type: 'conjuration', target: Target.globe, keywords: [Lasts(2), Forbid(['group'], { friendly: true })] });
    expect(d.text).toMatch(/No group spells on friends/);
  });

  it('L4: Ramp(hit, cap) prints the cap', () => {
    const d = card({ id: 'rv-ramp', name: 'R', ...base, target: Target.swordsman, keywords: [Ramp('hit', 2)] });
    expect(d.text).toContain('(max +2)');
  });

  it('On glossary is generated from the trigger list', () => {
    const g = glossary().find((e) => e.kind === 'on')!;
    expect(g.gloss).toContain('Recruit created');
    expect(g.gloss).toContain('Before movement');
  });

  it('glossary has effect verbs', () => {
    const kinds = glossary().map((e) => e.kind);
    for (const v of ['verb:expend', 'verb:withdraw', 'verb:give', 'verb:dispelAll', 'verb:terraform']) expect(kinds).toContain(v);
  });

  it('renderer orders lines: target, statics, triggers, effects', () => {
    const d = card({
      id: 'rv-order', name: 'O', ...base, target: Target.structure,
      keywords: [OnCast(Heal(1, 'hostOccupants')), On(When.startOfTurn, Heal(1, 'hostOccupants')), Lasts(2)],
    });
    const lines = d.text!.split('\n');
    expect(lines[1]).toBe('Lasts 2 turns.');
    expect(lines[2]).toMatch(/^Start of turn:/);
    expect(lines[3]).toMatch(/^Heal/);
  });

  it('Lasts 1 turn is singular', () => {
    const d = card({ id: 'rv-one', name: 'O', ...base, type: 'conjuration', target: Target.globe, keywords: [Lasts(1)] });
    expect(d.text).toBe('Globe.\nLasts 1 turn.');
  });
});

describe('review fixes: merge', () => {
  it('M4: conflicting duration or bot throws; identical values are fine', () => {
    expect(() => mergeFragments([{ duration: { turns: 2 } }, { duration: { turns: 3 } }])).toThrow(/duration/);
    expect(mergeFragments([{ duration: { turns: 2 } }, { duration: { turns: 2 } }]).duration).toEqual({ turns: 2 });
    const b1 = () => null;
    const b2 = () => null;
    expect(() => mergeFragments([{ bot: b1 }, { bot: b2 }])).toThrow(/bot/);
    expect(mergeFragments([{ bot: b1 }, { bot: b1 }]).bot).toBe(b1);
  });

  it('M6: stops running handlers once the spell is dispelled', () => {
    const log: string[] = [];
    const spells = [{ id: 7 }];
    const c = { spell: { id: 7 }, state: { spells } } as unknown as EventContext;
    const m = mergeFragments([
      { on: { 'turn:start': () => { log.push('a'); spells.length = 0; } } },
      { on: { 'turn:start': () => { log.push('b'); } } },
    ]);
    m.on!['turn:start']!(c, {} as GameEvent);
    expect(log).toEqual(['a']);
  });
});

describe('review fixes: card() validation', () => {
  it('rejects a duplicate id', () => {
    card({ id: 'rv-dup', name: 'D', ...base, target: Target.globe, keywords: [] });
    expect(() => card({ id: 'rv-dup', name: 'D', ...base, target: Target.globe, keywords: [] })).toThrow(/duplicate card id "rv-dup"/);
  });

  it('L1: host checks', () => {
    expect(() => card({ id: 'rv-l1a', name: 'x', ...base, target: Target.recruit, keywords: [Fleeting()] })).toThrow(/Fleeting.*group/);
    expect(() => card({ id: 'rv-l1b', name: 'x', ...base, target: Target.recruitGroup, keywords: [Ramp('hit')] })).toThrow(/Rage.*minion/);
    expect(() => card({ id: 'rv-l1c', name: 'x', ...base, target: Target.group, keywords: [Warded()] })).toThrow(/Warded.*minion/);
    expect(() => card({ id: 'rv-l1d', name: 'x', ...base, target: Target.structure, keywords: [On(When.onHit, Kill('victim'))] })).toThrow(/On hit.*minion/);
    expect(() => card({ id: 'rv-l1e', name: 'x', ...base, target: Target.group, keywords: [On(When.onDamage(), Kill('victim'))] })).toThrow(/On damage.*minion/);
    expect(() => card({ id: 'rv-l1f', name: 'x', ...base, target: Target.group, keywords: [Truce()] })).toThrow(/Truce.*globe/);
  });

  it('L2: helper cards cannot have onCast or canCast', () => {
    expect(() => card({ id: 'rv-l2a', name: 'x', ...base, helper: true, target: Target.group, keywords: [OnCast(Withdraw())] })).toThrow(/helper.*onCast/);
    expect(() => card({ id: 'rv-l2b', name: 'x', ...base, helper: true, target: Target.recruit.friendly, keywords: [] })).toThrow(/helper.*canCast/);
  });

  it('L5: Afterward needs a duration', () => {
    card({ id: 'rv-next', name: 'n', ...base, helper: true, target: Target.globe, keywords: [] });
    expect(() => card({ id: 'rv-l5', name: 'x', ...base, target: Target.globe, keywords: [Afterward('rv-next')] })).toThrow(/Afterward.*Lasts/);
  });

  it('L6: target builder rejects invalid combinations', () => {
    expect(() => Target.recruit.on('forest')).toThrow(/square/);
    expect(() => Target.group.alone).toThrow(/alone/);
    expect(() => Target.square.on('forest')).not.toThrow();
    expect(() => Target.swordsman.alone).not.toThrow();
  });
});

describe('review fixes: Ramp tokens', () => {
  it('M5: two Ramps on one card keep separate counters', () => {
    const e = mini([card({ id: 'rv-two', name: 'Two', ...base, target: Target.swordsman, keywords: [Ramp('hit'), Ramp('hit', 1)] })]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const id = g.minionIds[0];
    castMini(e, 'red', 'rv-two', { kind: 'minion', id });
    for (let i = 0; i < 3; i++) dispatch(e, 'attack:hit', { kind: 'minion', id }, {});
    expect(computeStats(e, id).hand).toBe(2 + 3 + 1);
    expect(Object.keys(e.state.spells[0].tokens).sort()).toEqual(['r0:rage', 'r1:rage']);
  });
});
