import { describe, it, expect } from 'vitest';
import { computeStats, dispatch, expireSpells, recheck, runCombats } from '@sanctum/engine/src/testing';
import {
  Afterward, Bound, card, Concealed, Fanfare, faceOf, Fleeting, Grant, Lasts, Pacified, Stackable, Target, Truce,
  Undispellable, Walk,
} from '../src/lang';
import { castMini, mini, put } from './lang-helpers';

const stats = (e: ReturnType<typeof mini>, id: number) => computeStats(e, id);
const glob = { kind: 'globe' as const };

describe('Grant', () => {
  it('adds stats to the host minion', () => {
    const e = mini([card({ id: 'g1', name: 'G1', house: 'war', cost: {}, type: 'alteration', target: Target.swordsman, keywords: [Grant({ hand: 2, armor: 1, level: 1 })] })]);
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    expect(castMini(e, 'red', 'g1', { kind: 'minion', id })).toBe('cast');
    expect(stats(e, id)).toMatchObject({ hand: 4, armor: 2, level: 2 });
  });

  it('can be limited to swordsmen, archers or enemy recruits', () => {
    const e = mini([
      card({ id: 'sw', name: 'Sw', house: 'war', cost: {}, type: 'alteration', target: Target.recruitGroup, keywords: [Grant({ hand: 1 }, { to: 'swordsmen' })] }),
      card({ id: 'ar', name: 'Ar', house: 'war', cost: {}, type: 'alteration', target: Target.recruitGroup, keywords: [Grant({ missile: 2, attacks: 1 }, { to: 'archers' })] }),
      card({ id: 'en', name: 'En', house: 'war', cost: {}, type: 'alteration', target: Target.square, keywords: [Grant({ level: -1 }, { to: 'enemies' })] }),
    ]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    const [s, a] = g.minionIds;
    castMini(e, 'red', 'sw', { kind: 'group', id: g.id });
    castMini(e, 'red', 'ar', { kind: 'group', id: g.id });
    expect([stats(e, s).hand, stats(e, a).hand]).toEqual([3, 0]);
    expect([stats(e, s).missile, stats(e, a).missile, stats(e, a).missileAttacks, stats(e, s).handAttacks]).toEqual([0, 4, 2, 1]);
    castMini(e, 'red', 'en', { kind: 'square', pos: { x: 6, y: 6 } });
    const enemy = put(e, 'blue', { x: 6, y: 6 }, ['swordsman']).minionIds[0];
    expect(stats(e, enemy).level).toBe(0);
    expect(stats(e, s).level).toBe(1);
  });

  it('attacks add hand attacks for swordsmen', () => {
    const e = mini([card({ id: 'at', name: 'At', house: 'war', cost: {}, type: 'alteration', target: Target.swordsman, keywords: [Grant({ attacks: 1 })] })]);
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    castMini(e, 'red', 'at', { kind: 'minion', id });
    expect(stats(e, id).handAttacks).toBe(2);
  });

  it('heal:true raises current hit points by the max hp granted', () => {
    const e = mini([card({ id: 'hp', name: 'Hp', house: 'war', cost: {}, type: 'alteration', target: Target.recruit, keywords: [Grant({ maxHp: 4 }, { heal: true })] })]);
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    castMini(e, 'red', 'hp', { kind: 'minion', id });
    expect(e.state.minions[id]).toMatchObject({ hp: 11, maxHp: 11 });
  });

  it('prints stat letters in a fixed order with signs', () => {
    card({ id: 'p1', name: 'P1', house: 'war', cost: {}, type: 'alteration', target: Target.recruit, keywords: [Grant({ attacks: 1, maxHp: 4, level: -1, armor: 1, hand: 1, missile: 2 })] });
    expect(faceOf('p1')!.lines).toEqual(['Recruit.', '+1 H, +2 M, +1 A, -1 L, +4 HP, +1 Attack.']);
    card({ id: 'p2', name: 'P2', house: 'war', cost: {}, type: 'alteration', target: Target.recruitGroup, keywords: [Grant({ hand: 1 }, { to: 'swordsmen' })] });
    expect(faceOf('p2')!.lines).toEqual(['Recruit group.', 'Swordsmen +1 H.']);
    card({ id: 'p3', name: 'P3', house: 'war', cost: {}, type: 'alteration', target: Target.square, keywords: [Grant({ level: -1 }, { to: 'enemies' })] });
    expect(faceOf('p3')!.lines).toEqual(['Square.', 'Enemy recruits -1 L.']);
  });
});

describe('simple keywords', () => {
  it('Walk, Concealed and Pacified grant their traits', () => {
    const e = mini([
      card({ id: 'w', name: 'W', house: 'life', cost: {}, type: 'alteration', target: Target.recruitGroup, keywords: [Walk('desert'), Walk('flight')] }),
      card({ id: 'c', name: 'C', house: 'life', cost: {}, type: 'alteration', target: Target.recruit, keywords: [Concealed()] }),
      card({ id: 'p', name: 'P', house: 'life', cost: {}, type: 'alteration', target: Target.recruit, keywords: [Pacified()] }),
    ]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    const [s, a] = g.minionIds;
    castMini(e, 'red', 'w', { kind: 'group', id: g.id });
    expect(stats(e, s).walks).toEqual(expect.arrayContaining(['desert', 'flight']));
    castMini(e, 'red', 'c', { kind: 'minion', id: s });
    expect(stats(e, s).concealed).toBe(true);
    castMini(e, 'red', 'p', { kind: 'minion', id: a });
    expect(stats(e, a)).toMatchObject({ handAttacks: 0, missileAttacks: 0, noDamage: true });
  });

  it('Lasts sets the duration, Stackable allows repeats, Undispellable hides the spell', () => {
    const e = mini([
      card({ id: 'l', name: 'L', house: 'war', cost: {}, type: 'conjuration', target: Target.globe, keywords: [Lasts(2)] }),
      card({ id: 's', name: 'S', house: 'war', cost: {}, type: 'alteration', target: Target.globe, keywords: [Stackable()] }),
      card({ id: 'u', name: 'U', house: 'war', cost: {}, type: 'alteration', target: Target.globe, keywords: [Undispellable()] }),
    ]);
    expect(castMini(e, 'red', 'l', glob)).toBe('cast');
    expect(e.state.spells[0].turnsLeft).toBe(2);
    expect(castMini(e, 'red', 's', glob)).toBe('cast');
    expect(castMini(e, 'red', 's', glob)).toBe('cast');
    expect(castMini(e, 'red', 'u', glob)).toBe('cast');
    expect(e.state.spells.filter((x) => x.cardId === 's')).toHaveLength(2);
    expect(e.state.spells.find((x) => x.cardId === 'u')!.visible).toBe(false);
    expireSpells(e);
    expireSpells(e);
    expect(e.state.spells.some((x) => x.cardId === 'l')).toBe(false);
  });

  it('Fleeting dispels the host group after its combat', () => {
    const e = mini([card({ id: 'f', name: 'F', house: 'war', cost: {}, type: 'alteration', target: Target.group, keywords: [Fleeting()] })]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    castMini(e, 'red', 'f', { kind: 'group', id: g.id });
    dispatch(e, 'combat:after', { kind: 'group', id: g.id }, {});
    expect(e.state.spells).toHaveLength(0);
  });

  it('Truce cancels the combat phase', () => {
    const e = mini([card({ id: 't', name: 'T', house: 'war', cost: {}, type: 'alteration', target: Target.globe, keywords: [Truce()] })]);
    const a = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const b = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']);
    castMini(e, 'red', 't', glob);
    runCombats(e);
    expect([e.state.minions[a.minionIds[0]].hp, e.state.minions[b.minionIds[0]].hp]).toEqual([7, 7]);
  });

  it('Bound ends the spell when the square stops being that terrain', () => {
    const e = mini([card({ id: 'b', name: 'B', house: 'life', cost: {}, type: 'alteration', target: Target.square, helper: true, keywords: [Bound('forest')] })]);
    e.state.terrain['6,6'] = 'forest';
    castMini(e, 'red', 'b', { kind: 'square', pos: { x: 6, y: 6 } });
    expect(e.state.spells).toHaveLength(1);
    e.state.terrain['6,6'] = 'plains';
    recheck(e, { kind: 'square', pos: { x: 6, y: 6 } });
    expect(e.state.spells).toHaveLength(0);
  });

  it('Afterward casts another spell on the globe when it expires', () => {
    const e = mini([
      card({ id: 'next', name: 'Next', house: 'life', cost: {}, type: 'alteration', target: Target.globe, helper: true, keywords: [Stackable()] }),
      card({ id: 'first', name: 'First', house: 'life', cost: {}, type: 'conjuration', target: Target.globe, keywords: [Lasts(1), Afterward('next')] }),
    ]);
    castMini(e, 'red', 'first', glob);
    expireSpells(e);
    expect(e.state.spells.map((s) => s.cardId)).toEqual(['next']);
  });

  it('print simple keywords', () => {
    card({ id: 'x1', name: 'X1', house: 'war', cost: {}, type: 'conjuration', target: Target.globe, keywords: [Truce(), Lasts(3)] });
    expect(faceOf('x1')!.lines).toEqual(['Globe.', 'Truce, Lasts 3 turns.']);
    card({ id: 'x2', name: 'X2', house: 'war', cost: {}, type: 'alteration', target: Target.recruit, keywords: [Pacified(), Concealed(), Walk('water'), Fleeting(), Stackable(), Undispellable(), Bound('forest')] });
    expect(faceOf('x2')!.lines).toEqual(['Recruit.', 'Pacified, Concealed, Waterwalk, Fleeting, Stackable, Undispellable, Bound to forest.']);
    card({ id: 'x3', name: 'X3', house: 'war', cost: {}, type: 'alteration', target: Target.recruitGroup, keywords: [Fanfare('triumphant music after a win')] });
    expect(faceOf('x3')!.lines).toEqual(['Recruit group.', 'Plays triumphant music after a win.']);
  });
});
