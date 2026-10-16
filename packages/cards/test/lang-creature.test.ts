import { beforeEach, describe, expect, it } from 'vitest';
import { computeStats, createGroup, dispatch, runMovement, spawnMinion } from '@sanctum/engine/src/testing';
import type { MinionSpec } from '@sanctum/engine';
import {
  Aura, Against, Ambush, card, Create, creatureSpec, faceOf, Grant, Hero, Immobile, Immune, Monster, Nomadic, Novices,
  On, OnCast, resetCards, statLine, Taunt, Target, Terraform, Territorial, When,
} from '../src/lang';
import { castMini, mini, put } from './lang-helpers';

beforeEach(() => resetCards());
const sq = (x: number, y: number) => ({ kind: 'square' as const, pos: { x, y } });
const town = (id: number, owner: 'red' | 'blue', x: number, y: number) =>
  ({ id, kind: 'town' as const, pos: { x, y }, owner, manaType: null, novices: 0, turnCount: 2, captured: false });
const dummy = (over: Partial<MinionSpec> = {}): MinionSpec => ({
  kind: 'monster', cls: 'monster', name: 'x', ...over,
  base: { hp: 9, level: 1, armor: 0, hand: 2, handAttacks: 1, missile: 0, missileAttacks: 0, walks: [] },
});
const monster = (id: string, ...kw: Parameters<typeof card>[0]['keywords']) =>
  card({
    id, name: id, house: 'war', cost: {}, type: 'summoning', host: 'minion', target: Target.square,
    keywords: [...kw, Monster({ name: id, cls: 'monster', hand: 2, hp: 9 })],
  });

describe('creature definitions', () => {
  it('builds monster and recruit specs and prints their stat lines', () => {
    const dragon = creatureSpec({ name: 'Dragon', cls: 'monster', hand: 4, armor: 1, hp: 16, level: 2, walks: ['flight'] }, 'war');
    expect(dragon).toMatchObject({ kind: 'monster', cls: 'monster', house: 'war' });
    expect(dragon.base).toMatchObject({ hand: 4, handAttacks: 1, hp: 16 });
    expect(statLine(dragon)).toBe('H:4 A:1 HP:16 L:2, Flight');
    const sylph = creatureSpec({ name: 'Sylph', cls: 'monster', missile: 3, missileAttacks: 2, hp: 15 }, 'life');
    expect(statLine(sylph)).toBe('M:3(x2) A:0 HP:15 L:1');
    const bard = creatureSpec({ name: 'Bard', cls: 'swordsman', nation: 'elf', hand: 0, armor: 3 }, 'life');
    expect(bard).toMatchObject({ kind: 'recruit', cls: 'swordsman', nation: 'elf', house: 'life' });
    expect(bard.base).toMatchObject({ hand: 0, handAttacks: 0, armor: 3, hp: 7 });
    expect(statLine(bard)).toBe('H:0 A:3 HP:7 L:1');
  });
});

describe('Monster', () => {
  it('summons a computer group with a hidden spell on each minion', () => {
    const e = mini([monster('grub', Territorial())]);
    expect(castMini(e, 'red', 'grub', sq(5, 5))).toBe('cast');
    const g = Object.values(e.state.groups)[0];
    expect(g).toMatchObject({ kind: 'monster', owner: 'red', control: 'computer', home: { x: 5, y: 5 }, botId: 'grub' });
    const m = e.state.minions[g.minionIds[0]];
    expect(m).toMatchObject({ name: 'grub', house: 'war', kind: 'monster' });
    expect(e.state.spells).toHaveLength(1);
    expect(e.state.spells[0]).toMatchObject({ cardId: 'grub', visible: false, owner: 'red', host: { kind: 'minion', id: m.id } });
    expect(faceOf('grub')!.lines).toEqual(['Square.', 'Territorial.', 'Summon grub (H:2 A:0 HP:9 L:1).']);
  });

  it('can be neutral, and needs host: minion', () => {
    const e = mini([card({
      id: 'neu', name: 'neu', house: 'war', cost: {}, type: 'summoning', host: 'minion', target: Target.square,
      keywords: [Monster({ name: 'neu', cls: 'monster', hand: 1, hp: 3 }, { neutral: true })],
    })]);
    castMini(e, 'red', 'neu', sq(5, 5));
    expect(Object.values(e.state.groups)[0].owner).toBe('neutral');
    expect(e.state.spells[0].owner).toBe('neutral');
    expect(() => card({
      id: 'bad', name: 'bad', house: 'war', cost: {}, type: 'summoning', target: Target.square,
      keywords: [Monster({ name: 'bad', cls: 'monster', hp: 3 })],
    })).toThrow(/Monster needs/);
  });
});

describe('Create and Hero', () => {
  it('creates a recruit in a structure, applies helpers and heals it', () => {
    const e = mini([
      card({ id: 'vet', name: 'Vet', house: 'war', cost: {}, type: 'alteration', helper: true, target: Target.recruit, keywords: [Grant({ maxHp: 4 })] }),
      card({
        id: 'chief', name: 'Chief', house: 'war', cost: {}, type: 'summoning', target: Target.structure.friendly,
        keywords: [Create({ name: 'Chief', cls: 'swordsman', nation: 'human', level: 2 }, { with: ['vet'] })],
      }),
    ]);
    e.state.structures[900] = town(900, 'red', 4, 4);
    expect(castMini(e, 'red', 'chief', { kind: 'structure', id: 900 })).toBe('cast');
    const m = Object.values(e.state.minions)[0];
    expect(m).toMatchObject({ name: 'Chief', nation: 'human', house: 'war', hp: 11, maxHp: 11, owner: 'red' });
    expect(m.base.level).toBe(2);
    expect(e.state.spells).toHaveLength(1);
    expect(faceOf('chief')!.lines[1]).toBe('Create Chief (H:2 A:1 HP:11 L:2) with Vet (+4 HP).');
  });

  it('joins a group, once per group, and can make several recruits of random nations', () => {
    const e = mini([
      card({ id: 'guard', name: 'Guard', house: 'war', cost: {}, type: 'summoning', target: Target.recruitGroup,
        keywords: [Create({ name: 'Guard', cls: 'swordsman' }, { onePerGroup: true })] }),
      card({ id: 'teeth', name: 'Teeth', house: 'war', cost: {}, type: 'summoning', target: Target.structure.friendly,
        keywords: [Create({ name: 'swordsman', cls: 'swordsman' }, { count: 2, randomNation: true })] }),
    ]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    expect(castMini(e, 'red', 'guard', { kind: 'group', id: g.id })).toBe('cast');
    expect(g.minionIds).toHaveLength(2);
    expect(castMini(e, 'red', 'guard', { kind: 'group', id: g.id })).toBe('squandered');
    e.state.structures[900] = town(900, 'red', 7, 2);
    expect(castMini(e, 'red', 'teeth', { kind: 'structure', id: 900 })).toBe('cast');
    const made = Object.values(e.state.minions).filter((m) => m.name === 'swordsman');
    expect(made).toHaveLength(2);
    expect(made.every((m) => m.nation !== null)).toBe(true);
  });

  it('Hero needs spell type hero', () => {
    expect(() => card({ id: 'h', name: 'h', house: 'war', cost: {}, type: 'manifestation', target: Target.globe, keywords: [Hero()] })).toThrow(/Hero needs/);
    card({ id: 'h2', name: 'h2', house: 'war', cost: {}, type: 'hero', target: Target.structure, keywords: [Hero()] });
    expect(faceOf('h2')!.lines).toEqual(['Town or colony.', 'Hero.']);
  });
});

describe('behaviours', () => {
  it('Territorial hunts within 2 squares of home, stays in its territory and re-homes when forced out', () => {
    const e = mini([monster('terr', Territorial())]);
    castMini(e, 'red', 'terr', sq(5, 5));
    const g = Object.values(e.state.groups)[0];
    const foe = put(e, 'blue', { x: 5, y: 9 }, ['swordsman']);
    runMovement(e);
    expect(g.pos).toEqual({ x: 5, y: 5 });
    foe.pos = { x: 5, y: 7 };
    runMovement(e);
    expect(g.pos).toEqual({ x: 5, y: 6 });
    expect(g.home).toEqual({ x: 5, y: 5 });
    g.pos = { x: 5, y: 8 };
    dispatch(e, 'group:move', { kind: 'group', id: g.id }, { from: { x: 5, y: 6 }, to: { x: 5, y: 8 } });
    expect(g.home).toEqual({ x: 5, y: 8 });
  });

  it('Nomadic hunts anywhere and roams when alone', () => {
    const e = mini([monster('nom', Nomadic())]);
    castMini(e, 'red', 'nom', sq(5, 5));
    const g = Object.values(e.state.groups)[0];
    const foe = put(e, 'blue', { x: 9, y: 9 }, ['swordsman']);
    runMovement(e);
    expect(Math.abs(g.pos!.x - 9) + Math.abs(g.pos!.y - 9)).toBe(7);
    foe.pos = null;
    const at = { ...g.pos! };
    runMovement(e);
    expect(g.pos).not.toEqual(at);
  });

  it('Immobile never moves, whatever the order', () => {
    const e = mini([monster('imm', Immobile())]);
    castMini(e, 'red', 'imm', sq(5, 5));
    const g = Object.values(e.state.groups)[0];
    g.moveOrder = 'e';
    put(e, 'blue', { x: 5, y: 7 }, ['swordsman']);
    runMovement(e);
    expect(g.pos).toEqual({ x: 5, y: 5 });
  });
});

describe('Against, Immune, Taunt, Aura', () => {
  it('Against adds hand damage versus a house, monsters only when asked', () => {
    const e = mini([monster('serp', Against(['death', 'despair'], { hand: 4, monstersOnly: true }))]);
    castMini(e, 'red', 'serp', sq(5, 5));
    const me = Object.values(e.state.minions)[0].id;
    const foe = createGroup(e, 'blue', { x: 6, y: 5 }, 'monster', 'computer');
    const dead = spawnMinion(e, foe.id, dummy({ house: 'death' }));
    const recruit = put(e, 'blue', { x: 7, y: 5 }, ['swordsman']);
    const strike = (victimId: number, kind = 'hand') =>
      dispatch(e, 'attacker:strikes', { kind: 'minion', id: me }, { victimId, kind, round: 2, damage: 2 }).data.damage;
    expect(strike(dead.id)).toBe(6);
    expect(strike(dead.id, 'missile')).toBe(2);
    expect(strike(recruit.minionIds[0])).toBe(2);
    expect(faceOf('serp')!.lines).toContain('+4 H against Death or Despair monsters.');
  });

  it('Immune blocks individual spells of those houses on the host only', () => {
    const e = mini([
      monster('shield', Immune(['death'])),
      card({ id: 'dprobe', name: 'd', house: 'death', cost: {}, type: 'manifestation', target: { type: 'monster' }, keywords: [] }),
      card({ id: 'wprobe', name: 'w', house: 'war', cost: {}, type: 'manifestation', target: { type: 'monster' }, keywords: [] }),
    ]);
    castMini(e, 'red', 'shield', sq(5, 5));
    const me = Object.values(e.state.minions)[0].id;
    expect(castMini(e, 'blue', 'dprobe', { kind: 'minion', id: me })).toBe('squandered');
    expect(castMini(e, 'blue', 'wprobe', { kind: 'minion', id: me })).toBe('cast');
  });

  it('Taunt sets the stat and Aura is a group aura with a different bonus for the host', () => {
    const e = mini([
      card({ id: 'ruse', name: 'Ruse', house: 'war', cost: {}, type: 'alteration', helper: true, target: Target.recruit, keywords: [Taunt()] }),
      card({ id: 'cmd', name: 'Command', house: 'war', cost: {}, type: 'alteration', helper: true, target: Target.recruit,
        keywords: [Aura({ hand: 1 }, { to: 'swordsmen', self: { hand: 3 } })] }),
    ]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman', 'archer']);
    const [a, b, c] = g.minionIds;
    e.state.spells.push(
      { id: 800, cardId: 'ruse', owner: 'red', host: { kind: 'minion', id: a }, visible: false, turnsLeft: null, tokens: {} },
      { id: 801, cardId: 'cmd', owner: 'red', host: { kind: 'minion', id: a }, visible: false, turnsLeft: null, tokens: {} },
    );
    expect(computeStats(e, a).taunt).toBe(true);
    expect(computeStats(e, b).taunt).toBe(false);
    expect(computeStats(e, a).hand).toBe(5);
    expect(computeStats(e, b).hand).toBe(3);
    expect(computeStats(e, c).hand).toBe(0);
    expect(faceOf('cmd')!.lines).toEqual(['Recruit.', 'Group aura: swordsmen +1 H; this minion +3 H.']);
    expect(faceOf('ruse')!.lines).toEqual(['Recruit.', 'Taunt.']);
  });
});

describe('Ambush', () => {
  const amb = () =>
    card({
      id: 'amb', name: 'Amb', house: 'life', cost: {}, type: 'summoning', host: 'minion', target: Target.globe,
      keywords: [Ambush({ name: 'Wisp', cls: 'monster', hand: 3, hp: 7 }, { terrain: ['forest'], next: 'recruit', becomes: 'lava' })],
    });

  it('appears before combat next to a non-friendly recruit group, hides after, and ends when killed', () => {
    const e = mini([amb()]);
    e.state.terrain['5,4'] = 'forest';
    castMini(e, 'red', 'amb', { kind: 'globe' });
    const hopper = Object.values(e.state.groups).find((g) => g.kind === 'monster')!;
    expect(hopper.pos).toBeNull();
    expect(e.state.spells).toHaveLength(2); // one on the minion, one controller on the globe
    put(e, 'red', { x: 5, y: 3 }, ['swordsman']); // friendly: not a victim
    dispatch(e, 'combat:before');
    expect(hopper.pos).toBeNull();
    put(e, 'blue', { x: 5, y: 5 }, ['swordsman']);
    dispatch(e, 'combat:before');
    expect(hopper.pos).toEqual({ x: 5, y: 4 });
    expect(e.state.terrain['5,4']).toBe('lava');
    dispatch(e, 'turn:afterCombat');
    expect(hopper.pos).toBeNull();
    e.state.minions[hopper.minionIds[0]].status = 'dead';
    dispatch(e, 'minion:dies', { kind: 'minion', id: hopper.minionIds[0] }, {});
    expect(e.state.spells.filter((s) => s.host.kind === 'globe')).toHaveLength(0);
    expect(faceOf('amb')!.lines[1]).toContain('Summon Wisp (H:3 A:0 HP:7 L:1) off the board.');
  });
});

describe('target, effects and triggers', () => {
  it('Target.in needs the target to stand on that terrain', () => {
    const e = mini([card({ id: 'forestcast', name: 'f', house: 'life', cost: {}, type: 'manifestation', target: Target.recruitGroup.in('forest'), keywords: [] })]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(castMini(e, 'red', 'forestcast', { kind: 'group', id: g.id })).toBe('squandered');
    e.state.terrain['4,4'] = 'forest';
    expect(castMini(e, 'red', 'forestcast', { kind: 'group', id: g.id })).toBe('cast');
    expect(faceOf('forestcast')!.lines[0]).toBe('Recruit group in forest.');
    expect(() => Target.square.in('forest')).toThrow();
  });

  it('Novices adds novices to the target structure', () => {
    const e = mini([card({ id: 'allies', name: 'a', house: 'life', cost: {}, type: 'manifestation', target: Target.structure.friendly, keywords: [OnCast(Novices(2, 'elf'))] })]);
    e.state.structures[900] = town(900, 'red', 6, 6);
    castMini(e, 'red', 'allies', { kind: 'structure', id: 900 });
    expect(e.state.structures[900].novices).toBe(2);
    expect(e.state.structures[900].noviceNations).toEqual(['elf', 'elf']);
    expect(faceOf('allies')!.lines[1]).toBe('Create 2 Elf novices in the town.');
  });

  it('Terraform aroundGroup and When.moves work for a minion host', () => {
    const e = mini([card({
      id: 'blight', name: 'Blight', house: 'war', cost: {}, type: 'alteration', target: Target.recruit,
      keywords: [On(When.beforeMovement, Terraform('barren', 'aroundGroup')), On(When.moves, Terraform('barren', 'aroundGroup'))],
    })]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    castMini(e, 'red', 'blight', { kind: 'minion', id: g.minionIds[0] });
    dispatch(e, 'movement:before');
    for (const k of ['5,4', '3,4', '4,3', '4,5']) expect(e.state.terrain[k]).toBe('barren');
    g.pos = { x: 6, y: 3 }; // (6,6) would touch the blue Sanctum entrances, which never change terrain
    dispatch(e, 'group:move', { kind: 'group', id: g.id }, { from: { x: 4, y: 4 }, to: { x: 6, y: 3 } });
    expect(e.state.terrain['7,3']).toBe('barren');
    expect(faceOf('blight')!.lines).toEqual([
      'Recruit.', 'Before movement: Squares next to its group become barren.', 'After it moves: Squares next to its group become barren.',
    ]);
  });
});
