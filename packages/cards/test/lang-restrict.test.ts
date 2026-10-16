import { beforeEach, describe, it, expect } from 'vitest';
import { takeDamage } from '@sanctum/engine/src/testing';
import { card, resetCards, Concealment, faceOf, Forbid, Grant, Lasts, Shroud, Target, Warded } from '../src/lang';
import { castMini, mini, put } from './lang-helpers';

const spellOn = (id: string, target: Parameters<typeof card>[0]['target'], type: 'manifestation' | 'alteration' = 'manifestation') =>
  card({ id, name: id, house: 'war', cost: {}, type, target, keywords: [] });
const lock = (id: string, ...k: Parameters<typeof card>[0]['keywords']) =>
  card({ id, name: id, house: 'war', cost: {}, type: 'conjuration', target: Target.globe, keywords: [Lasts(5), ...k] });
const glob = { kind: 'globe' as const };

// Several tests declare the same helper ids ('a-group', 'ward', ...); card() rejects duplicates.
beforeEach(() => resetCards());
const hand = { kind: 'hand' as const, ignoresArmor: false, magical: false };

describe('Forbid', () => {
  it('blocks spell classes for everyone', () => {
    const e = mini([
      lock('no-globe', Forbid(['globe'])),
      spellOn('a-globe', Target.globe), spellOn('a-group', Target.group), spellOn('a-struct', Target.structure),
    ]);
    e.state.structures[900] = { id: 900, kind: 'town', pos: { x: 8, y: 2 }, owner: 'red', manaType: null, novices: 0, turnCount: 2, captured: false };
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    castMini(e, 'red', 'no-globe', glob);
    expect(castMini(e, 'blue', 'a-globe', glob)).toBe('squandered');
    expect(castMini(e, 'red', 'a-group', { kind: 'group', id: g.id })).toBe('cast');
    expect(castMini(e, 'red', 'a-struct', { kind: 'structure', id: 900 })).toBe('cast');
  });

  it('by caster on friendly targets only', () => {
    const e = mini([
      lock('court', Forbid(['group', 'individual'], { by: 'caster', friendly: true })),
      spellOn('a-group', Target.group), spellOn('a-minion', Target.recruit),
    ]);
    const mine = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const theirs = put(e, 'blue', { x: 6, y: 6 }, ['swordsman']);
    castMini(e, 'red', 'court', glob);
    expect(castMini(e, 'red', 'a-group', { kind: 'group', id: mine.id })).toBe('squandered');
    expect(castMini(e, 'red', 'a-minion', { kind: 'minion', id: mine.minionIds[0] })).toBe('squandered');
    expect(castMini(e, 'red', 'a-group', { kind: 'group', id: theirs.id })).toBe('cast');
    expect(castMini(e, 'blue', 'a-group', { kind: 'group', id: theirs.id })).toBe('cast');
  });

  it('prints', () => {
    lock('f1', Forbid(['globe']));
    expect(faceOf('f1')!.lines).toEqual(['Globe.', 'Lasts 5 turns.', 'No globe spells.']);
    lock('f2', Forbid(['group', 'individual'], { by: 'caster', friendly: true }));
    expect(faceOf('f2')!.lines).toEqual(['Globe.', 'Lasts 5 turns.', 'Caster: no group or individual spells on friends.']);
  });
});

describe('Shroud', () => {
  it('on a group shields the group and its members', () => {
    const e = mini([
      card({ id: 'mantle', name: 'm', house: 'life', cost: {}, type: 'conjuration', target: Target.group, keywords: [Lasts(2), Shroud()] }),
      spellOn('a-group', Target.group), spellOn('a-minion', Target.recruit),
    ]);
    const shielded = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const other = put(e, 'blue', { x: 6, y: 6 }, ['swordsman']);
    castMini(e, 'red', 'mantle', { kind: 'group', id: shielded.id });
    expect(castMini(e, 'blue', 'a-group', { kind: 'group', id: shielded.id })).toBe('squandered');
    expect(castMini(e, 'blue', 'a-minion', { kind: 'minion', id: shielded.minionIds[0] })).toBe('squandered');
    expect(castMini(e, 'red', 'a-group', { kind: 'group', id: other.id })).toBe('cast');
  });

  it('can limit itself to group spells', () => {
    const e = mini([
      card({ id: 'favor', name: 'f', house: 'life', cost: {}, type: 'alteration', target: Target.group.nonFriendly, keywords: [Shroud({ from: ['group'] })] }),
      spellOn('a-group', Target.group), spellOn('a-minion', Target.recruit),
    ]);
    const mine = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const theirs = put(e, 'blue', { x: 6, y: 6 }, ['swordsman']);
    expect(castMini(e, 'red', 'favor', { kind: 'group', id: mine.id })).toBe('squandered');
    castMini(e, 'red', 'favor', { kind: 'group', id: theirs.id });
    expect(castMini(e, 'red', 'a-group', { kind: 'group', id: theirs.id })).toBe('squandered');
    expect(castMini(e, 'red', 'a-minion', { kind: 'minion', id: theirs.minionIds[0] })).toBe('cast');
  });

  it('on a minion against friendly spells protects the minion and its group from its owner only', () => {
    const e = mini([
      card({ id: 'wolf', name: 'w', house: 'war', cost: {}, type: 'alteration', target: Target.swordsman, keywords: [Shroud({ against: 'friendly' })] }),
      spellOn('a-group', Target.group), spellOn('a-minion', Target.recruit),
    ]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const id = g.minionIds[0];
    castMini(e, 'red', 'wolf', { kind: 'minion', id });
    expect(castMini(e, 'red', 'a-minion', { kind: 'minion', id })).toBe('squandered');
    expect(castMini(e, 'red', 'a-group', { kind: 'group', id: g.id })).toBe('squandered');
    expect(castMini(e, 'blue', 'a-minion', { kind: 'minion', id })).toBe('cast');
    expect(castMini(e, 'blue', 'a-group', { kind: 'group', id: g.id })).toBe('cast');
  });

  it('prints', () => {
    card({ id: 's1', name: 's1', house: 'life', cost: {}, type: 'alteration', target: Target.group, keywords: [Shroud()] });
    card({ id: 's2', name: 's2', house: 'life', cost: {}, type: 'alteration', target: Target.group, keywords: [Shroud({ from: ['group'] })] });
    card({ id: 's3', name: 's3', house: 'life', cost: {}, type: 'alteration', target: Target.group, keywords: [Shroud({ against: 'friendly' })] });
    expect(faceOf('s1')!.lines[1]).toBe('Shroud.');
    expect(faceOf('s2')!.lines[1]).toBe('Shroud (group spells).');
    expect(faceOf('s3')!.lines[1]).toBe('Shroud (friendly spells).');
  });
});

describe('Warded', () => {
  const setup = (n?: number) => {
    const e = mini([
      card({ id: 'ward', name: 'w', house: 'life', cost: {}, type: 'alteration', target: Target.recruit, keywords: n === undefined ? [Warded()] : [Warded(n)] }),
      card({ id: 'charm', name: 'c', house: 'life', cost: {}, type: 'alteration', target: Target.recruit, keywords: [Grant({ hand: 1 })] }),
    ]);
    const victim = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    const attacker = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']).minionIds[0];
    castMini(e, 'red', 'ward', { kind: 'minion', id: victim });
    e.state.minions[victim].combat.armor = 1;
    return { e, victim, attacker };
  };

  it('Warded() cancels combat damage from unenchanted recruits, not enchanted ones', () => {
    const { e, victim, attacker } = setup();
    expect(takeDamage(e, victim, 3, hand, attacker)).toBe('bounced');
    expect(e.state.minions[victim].hp).toBe(7);
    castMini(e, 'blue', 'charm', { kind: 'minion', id: attacker });
    e.state.minions[victim].combat.armor = 1;
    expect(takeDamage(e, victim, 3, hand, attacker)).toBe('damaged');
    expect(e.state.minions[victim].hp).toBe(5);
  });

  it('Warded(1) reduces damage by 1 before armor', () => {
    const { e, victim, attacker } = setup(1);
    e.state.minions[victim].combat.armor = 0;
    expect(takeDamage(e, victim, 3, hand, attacker)).toBe('damaged');
    expect(e.state.minions[victim].hp).toBe(5);
  });

  it('prints', () => {
    card({ id: 'w1', name: 'w1', house: 'life', cost: {}, type: 'alteration', target: Target.recruit, keywords: [Warded(), Grant({ maxHp: 4 })] });
    card({ id: 'w2', name: 'w2', house: 'life', cost: {}, type: 'alteration', target: Target.recruit, keywords: [Warded(1)] });
    expect(faceOf('w1')!.lines).toEqual(['Recruit.', 'Warded.', '+4 HP.']);
    expect(faceOf('w2')!.lines).toEqual(['Recruit.', 'Warded 1.']);
  });
});

describe('Concealment', () => {
  it('blocks individual spells on every minion but not group spells', () => {
    const e = mini([
      card({ id: 'fog', name: 'f', house: 'war', cost: {}, type: 'conjuration', target: Target.globe, keywords: [Lasts(3), Concealment()] }),
      spellOn('a-group', Target.group), spellOn('a-minion', Target.recruit),
    ]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    castMini(e, 'red', 'fog', glob);
    expect(castMini(e, 'red', 'a-minion', { kind: 'minion', id: g.minionIds[0] })).toBe('squandered');
    expect(castMini(e, 'red', 'a-group', { kind: 'group', id: g.id })).toBe('cast');
    card({ id: 'fog2', name: 'f2', house: 'war', cost: {}, type: 'conjuration', target: Target.globe, keywords: [Lasts(3), Concealment()] });
    expect(faceOf('fog2')!.lines).toEqual(['Globe.', 'Lasts 3 turns.', 'All minions are Concealed.']);
  });
});
