import { describe, it, expect } from 'vitest';
import { dispatch, runMovement } from '@sanctum/engine/src/testing';
import {
  AddMana, CancelMoves, card, Damage, DispelAll, Expend, faceOf, Give, GiveSquares, Grant, Heal, Kill, MoveTwice, On,
  OnCast, RandomMove, Stackable, Target, Terraform, Undispellable, When, Withdraw,
} from '../src/lang';
import { advance, castMini, mini, put } from './lang-helpers';

const mark = card({ id: 'mark', name: 'Mark', house: 'war', cost: {}, type: 'alteration', helper: true, target: Target.recruit, keywords: [Grant({ armor: 1 })] });
const hidden = card({ id: 'hidden', name: 'Hidden', house: 'war', cost: {}, type: 'alteration', helper: true, target: Target.recruit, keywords: [Undispellable(), Grant({ armor: 1 })] });
const spell = (id: string, target: Parameters<typeof card>[0]['target'], ...effects: Parameters<typeof OnCast>) =>
  card({ id, name: id, house: 'war', cost: {}, type: 'manifestation', target, keywords: [OnCast(...effects)] });
const on = (id: string, host: Parameters<typeof card>[0]['target'], trigger: Parameters<typeof On>[0], ...effects: Parameters<typeof On>[1][]) =>
  card({ id, name: id, house: 'war', cost: {}, type: 'alteration', target: host, keywords: [Stackable(), On(trigger, ...effects)] });
const glob = { kind: 'globe' as const };

describe('cast-time effects', () => {
  it('Heal full (each), Damage (each) and Kill', () => {
    const e = mini([
      spell('heal', Target.group, Heal('full', 'targetEach')),
      spell('dmg', Target.group, Damage(2, 'targetEach')),
      spell('kill', Target.recruit, Kill('target')),
    ]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman']);
    const ids = [...g.minionIds];
    castMini(e, 'red', 'dmg', { kind: 'group', id: g.id });
    expect(ids.map((i) => e.state.minions[i].hp)).toEqual([5, 5]);
    castMini(e, 'red', 'heal', { kind: 'group', id: g.id });
    expect(ids.map((i) => e.state.minions[i].hp)).toEqual([7, 7]);
    castMini(e, 'red', 'kill', { kind: 'minion', id: ids[0] });
    expect(e.state.minions[ids[0]].status).toBe('dead');
  });

  it('Terraform: target square, adjacent squares of a structure, contiguous terrain', () => {
    const e = mini([
      spell('one', Target.square, Terraform('lava')),
      spell('adj', Target.structure, Terraform('desert', 'adjacent')),
      spell('cont', Target.square.on('forest'), Terraform('barren', 'contiguous', 'forest')),
    ]);
    castMini(e, 'red', 'one', { kind: 'square', pos: { x: 5, y: 5 } });
    expect(e.state.terrain['5,5']).toBe('lava');
    e.state.structures[900] = { id: 900, kind: 'town', pos: { x: 4, y: 4 }, owner: 'red', manaType: null, novices: 0, turnCount: 2, captured: false };
    castMini(e, 'red', 'adj', { kind: 'structure', id: 900 });
    for (const k of ['5,4', '3,4', '4,3', '4,5']) expect(e.state.terrain[k]).toBe('desert');
    for (const k of ['7,3', '8,3', '8,2']) e.state.terrain[k] = 'forest';
    castMini(e, 'red', 'cont', { kind: 'square', pos: { x: 7, y: 3 } });
    for (const k of ['7,3', '8,3']) expect(e.state.terrain[k]).toBe('barren');
    expect(e.state.terrain['8,2']).toBe('barren');
  });

  it('DispelAll removes visible spells on the group and members but not undispellable ones', () => {
    const e = mini([
      mark,
      hidden,
      spell('mark-all', Target.group, Give('mark', 'targetEach')),
      spell('hide-all', Target.group, Give('hidden', 'targetEach')),
      spell('clean', Target.group, DispelAll()),
    ]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const id = g.minionIds[0];
    castMini(e, 'red', 'mark-all', { kind: 'group', id: g.id });
    castMini(e, 'red', 'hide-all', { kind: 'group', id: g.id });
    expect(e.state.spells.map((s) => s.cardId).sort()).toEqual(['hidden', 'mark']);
    castMini(e, 'red', 'clean', { kind: 'group', id: g.id });
    expect(e.state.spells.map((s) => s.cardId)).toEqual(['hidden']);
    expect(id).toBeGreaterThan(0);
  });

  it('Give once does not stack; Give without once does; GiveSquares marks each contiguous square once', () => {
    const e = mini([
      mark,
      spell('once', Target.group, Give('mark', 'targetEach', true)),
      spell('many', Target.group, Give('mark', 'targetEach')),
      card({ id: 'sq', name: 'sq', house: 'war', cost: {}, type: 'alteration', helper: true, target: Target.square, keywords: [Grant({ level: -1 })] }),
      card({ id: 'glade', name: 'glade', house: 'war', cost: {}, type: 'manifestation', target: Target.square.on('forest'), keywords: [OnCast(GiveSquares('sq', 'forest'))] }),
    ]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    castMini(e, 'red', 'once', { kind: 'group', id: g.id });
    castMini(e, 'red', 'once', { kind: 'group', id: g.id });
    expect(e.state.spells.filter((s) => s.cardId === 'mark')).toHaveLength(1);
    castMini(e, 'red', 'many', { kind: 'group', id: g.id });
    expect(e.state.spells.filter((s) => s.cardId === 'mark')).toHaveLength(2);
    for (const k of ['6,6', '7,6']) e.state.terrain[k] = 'forest';
    castMini(e, 'red', 'glade', { kind: 'square', pos: { x: 6, y: 6 } });
    castMini(e, 'red', 'glade', { kind: 'square', pos: { x: 6, y: 6 } });
    expect(e.state.spells.filter((s) => s.cardId === 'sq')).toHaveLength(2);
  });

  it('MoveTwice, RandomMove and CancelMoves steer a group', () => {
    const e = mini([
      spell('twice', Target.recruitGroup, MoveTwice()),
      spell('amok', Target.recruitGroup, MoveTwice(), RandomMove()),
      spell('halt', Target.globe, CancelMoves()),
    ]);
    const a = put(e, 'red', { x: 3, y: 3 }, ['swordsman']);
    a.moveOrder = 'e';
    castMini(e, 'red', 'twice', { kind: 'group', id: a.id });
    runMovement(e);
    expect(a.pos).toEqual({ x: 5, y: 3 });
    const b = put(e, 'red', { x: 4, y: 6 }, ['swordsman']);
    castMini(e, 'red', 'amok', { kind: 'group', id: b.id });
    expect(b.moveOrder).not.toBeNull();
    const c = put(e, 'red', { x: 7, y: 5 }, ['swordsman']);
    c.moveOrder = 'n';
    castMini(e, 'red', 'halt', glob);
    expect(c.moveOrder).toBeNull();
  });

  it('Expend dispels the spell itself', () => {
    const e = mini([card({ id: 'ex', name: 'Ex', house: 'war', cost: {}, type: 'alteration', target: Target.globe, keywords: [OnCast(Expend())] })]);
    castMini(e, 'red', 'ex', glob);
    expect(e.state.spells).toHaveLength(0);
  });
});

describe('triggers', () => {
  it('startOfTurn heals the host group; manaPhase pays the caster or the structure owner', () => {
    const e = mini([
      on('hh', Target.recruit, When.startOfTurn, Heal(1, 'hostGroup')),
      on('mana', Target.globe, When.manaPhase, AddMana('clarity', 1)),
      on('town', Target.structure, When.manaPhase, AddMana('strife', 2, 'structureOwner')),
    ]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman']);
    const [hurt, other] = g.minionIds;
    e.state.minions[hurt].hp = 3;
    castMini(e, 'red', 'hh', { kind: 'minion', id: other });
    e.state.structures[900] = { id: 900, kind: 'town', pos: { x: 8, y: 2 }, owner: 'blue', manaType: null, novices: 0, turnCount: 2, captured: false };
    castMini(e, 'red', 'mana', glob);
    castMini(e, 'red', 'town', { kind: 'structure', id: 900 });
    advance(e);
    expect(e.state.minions[hurt].hp).toBe(4);
    expect(e.state.players.red.mana.clarity).toBe(1);
    expect(e.state.players.blue.mana.strife).toBe(2);
    expect(e.state.players.red.mana.strife).toBe(0);
  });

  it('eachRound can target one round and only the host group; Withdraw ends the combat', () => {
    const e = mini([on('r3', Target.group, When.eachRound(3), Withdraw())]);
    const mine = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const theirs = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']);
    castMini(e, 'red', 'r3', { kind: 'group', id: mine.id });
    expect(dispatch(e, 'round:start', { kind: 'group', id: mine.id }, { round: 2 }).data.endCombat).toBeUndefined();
    expect(dispatch(e, 'round:start', { kind: 'group', id: theirs.id }, { round: 3 }).data.endCombat).toBeUndefined();
    expect(dispatch(e, 'round:start', { kind: 'group', id: mine.id }, { round: 3 }).data.endCombat).toBe(true);
  });

  it('startOfCombat can be limited to monster opponents', () => {
    const e = mini([on('vm', Target.group, When.startOfCombat('monster'), Withdraw())]);
    const mine = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const rec = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']);
    castMini(e, 'red', 'vm', { kind: 'group', id: mine.id });
    expect(dispatch(e, 'combat:start', { kind: 'group', id: mine.id }, { opponent: rec.id }).data.endCombat).toBeUndefined();
  });

  it('enter can be limited to recruit groups', () => {
    const e = mini([on('en', Target.square, When.enter('recruit'), Heal('full', 'enterer'))]);
    castMini(e, 'red', 'en', { kind: 'square', pos: { x: 5, y: 5 } });
    const g = put(e, 'red', { x: 5, y: 5 }, ['swordsman']);
    e.state.minions[g.minionIds[0]].hp = 2;
    dispatch(e, 'group:enter', { kind: 'group', id: g.id }, {});
    expect(e.state.minions[g.minionIds[0]].hp).toBe(7);
  });

  it('created, onHit and onDamage use the event data', () => {
    const e = mini([
      mark,
      on('cr', Target.structure, When.created, Give('mark', 'created')),
      on('hit', Target.recruit, When.onHit, Give('mark', 'victim')),
      on('dm', Target.recruit, When.onDamage('monster'), Kill('victim')),
    ]);
    e.state.structures[900] = { id: 900, kind: 'town', pos: { x: 4, y: 4 }, owner: 'red', manaType: null, novices: 0, turnCount: 2, captured: false };
    castMini(e, 'red', 'cr', { kind: 'structure', id: 900 });
    const born = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    dispatch(e, 'minion:created', { kind: 'structure', id: 900 }, { minionId: born });
    expect(e.state.spells.filter((s) => s.cardId === 'mark')).toHaveLength(1);

    const hitter = put(e, 'red', { x: 6, y: 6 }, ['swordsman']).minionIds[0];
    const foe = put(e, 'blue', { x: 7, y: 6 }, ['swordsman']).minionIds[0];
    castMini(e, 'red', 'hit', { kind: 'minion', id: hitter });
    dispatch(e, 'attacker:hits', { kind: 'minion', id: hitter }, { victimId: foe });
    expect(e.state.spells.some((s) => s.cardId === 'mark' && s.host.kind === 'minion' && s.host.id === foe)).toBe(true);

    castMini(e, 'red', 'dm', { kind: 'minion', id: hitter });
    dispatch(e, 'attacker:damages', { kind: 'minion', id: hitter }, { victimId: foe });
    expect(e.state.minions[foe].status).toBe('alive'); // a recruit, not a monster
  });
});

describe('effect text', () => {
  it('prints every effect verb, statics then triggers then cast effects', () => {
    card({ id: 't-all', name: 'T', house: 'war', cost: {}, type: 'alteration', target: Target.structure, keywords: [
      OnCast(Terraform('desert', 'adjacent'), Terraform('plains'), Terraform('barren', 'contiguous', 'forest'), Damage(5, 'targetEach'), Kill('target'), DispelAll()),
      On(When.startOfTurn, Heal(1, 'hostOccupants'), Heal('full', 'hostGroupHurtOther')),
      On(When.startOfCombat('monster'), Withdraw()),
      On(When.eachRound(), Withdraw()),
      On(When.afterAllCombat, Expend()),
      On(When.beforeMovement, CancelMoves()),
      On(When.manaPhase, AddMana('strife', 2, 'structureOwner'), AddMana('clarity', 1)),
      On(When.enter('recruit'), Heal('full', 'allBoard'), Give('mark', 'enterer', true)),
      On(When.created, Heal(4, 'created'), Give('mark', 'created')),
      OnCast(GiveSquares('mark', 'forest'), MoveTwice(), RandomMove(), MoveTwice(), Damage(1), Heal(2)),
    ] });
    expect(faceOf('t-all')!.lines).toEqual([
      'Town or colony.',
      'Start of turn: Heal each recruit here by 1, then heal the most hurt ally fully.',
      'Start of combat (vs monsters): Withdraw.',
      'Each round: Withdraw.',
      'After all combat: Expend.',
      'Before movement: Cancel all recruit move orders.',
      'Mana: +2 Strife to its owner, then +1 Clarity.',
      'On enter (recruit group): Heal every minion fully, then entering group gets Mark (+1 A) once each.',
      'Recruit created: Heal each new recruit by 4, then each new recruit gets Mark (+1 A).',
      'Adjacent squares become desert, then square becomes plains, then contiguous forest becomes barren, then deal 5 damage to each member, then kill the target, then dispel every enchantment on the group.',
      'Each contiguous forest square gets Mark (+1 A), then moves twice in a random direction, then moves twice, then deal 1 damage, then heal 2.',
    ]);
    card({ id: 't-min', name: 'T', house: 'war', cost: {}, type: 'alteration', target: Target.recruit, keywords: [
      On(When.onHit, Give('mark', 'victim')),
      On(When.onDamage('monster'), Kill('victim')),
    ] });
    expect(faceOf('t-min')!.lines).toEqual([
      'Recruit.',
      'On hit: Victim gets Mark (+1 A).',
      'On damage (monster): Kill the victim.',
    ]);
  });
});
