import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { killMinion } from '../src/death';
import { dispel, executeCast, expireSpells, recheck, targetLegal } from '../src/spells';
import { spellsOn } from '../src/query';
import { gameEngine, blankEngine, put } from './helpers';
import type { BaseStats } from '../src/types';

const bolt = defineCard({
  id: 'bolt', name: 'Bolt', house: 'war', cost: { strife: 1 }, type: 'manifestation', target: 'recruit',
  onCast: (c, t) => { if (t.kind === 'minion') c.damage(t.id, 3); },
});
const ward = defineCard({
  id: 'ward', name: 'Ward', house: 'war', cost: {}, type: 'alteration', target: 'recruitGroup',
  persistent: (q, host) => host.kind === 'group' && q.terrainAt(q.group(host.id)!.pos!) !== 'water',
});
const shield = defineCard({
  id: 'shield', name: 'Shield', house: 'war', cost: {}, type: 'conjuration', target: 'recruitGroup', duration: { turns: 2 },
});
const picky = defineCard({
  id: 'picky', name: 'Picky', house: 'war', cost: {}, type: 'manifestation', target: 'recruit', canCast: () => false,
});
const wolfBase: BaseStats = { hp: 5, level: 1, armor: 0, hand: 2, handAttacks: 1, missile: 0, missileAttacks: 0, walks: [] };
const wolves = defineCard({
  id: 'wolves', name: 'Wolves', house: 'war', cost: {}, type: 'summoning', target: 'square',
  onCast: (c, t) => {
    if (t.kind === 'square') c.summon({ pos: t.pos, minions: [{ kind: 'monster', cls: 'monster', name: 'wolf', base: wolfBase }] });
  },
});
const draw2 = defineCard({
  id: 'draw2', name: 'Draw Two', house: 'war', cost: {}, type: 'manifestation', target: 'globe',
  onCast: (c) => { c.draw('red', 2); },
});
const needsB = defineCard({
  id: 'needsB', name: 'Needs B', house: 'war', cost: {}, type: 'alteration', target: 'globe',
  persistent: (q) => q.state.spells.some((sp) => sp.cardId === 'b'),
});
const b = defineCard({ id: 'b', name: 'B', house: 'war', cost: {}, type: 'alteration', target: 'globe' });

const all = [bolt, ward, shield, picky, wolves, draw2, needsB, b];

describe('targetLegal', () => {
  it('requires the right target kind and a live minion', () => {
    const e = blankEngine(all);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(targetLegal(e, bolt, 'red', { kind: 'minion', id: g.minionIds[0] })).toBe(true);
    expect(targetLegal(e, bolt, 'red', { kind: 'group', id: g.id })).toBe(false);
    expect(targetLegal(e, ward, 'red', { kind: 'group', id: g.id })).toBe(true);
  });

  it('hides enemy minions in forest unless the card ignores concealment', () => {
    const e = blankEngine(all);
    e.state.terrain['4,4'] = 'forest';
    const g = put(e, 'blue', { x: 4, y: 4 }, ['archer']);
    const ref = { kind: 'minion' as const, id: g.minionIds[0] };
    expect(targetLegal(e, bolt, 'red', ref)).toBe(false);
    expect(targetLegal(e, bolt, 'blue', ref)).toBe(true);
    expect(targetLegal(e, { ...bolt, ignoresConcealment: true }, 'red', ref)).toBe(true);
  });

  it('square spells need an empty square that is not part of a Sanctum', () => {
    const e = blankEngine(all);
    put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(targetLegal(e, wolves, 'red', { kind: 'square', pos: { x: 4, y: 4 } })).toBe(false);
    expect(targetLegal(e, wolves, 'red', { kind: 'square', pos: { x: 5, y: 5 } })).toBe(true);
    expect(targetLegal(e, wolves, 'red', { kind: 'square', pos: { x: 2, y: 2 } })).toBe(false);
    expect(targetLegal(e, wolves, 'red', { kind: 'square', pos: { x: 3, y: 2 } })).toBe(false);
    expect(targetLegal(e, wolves, 'red', { kind: 'square', pos: { x: 40, y: 2 } })).toBe(false);
  });
});

describe('executeCast', () => {
  it('runs a manifestation and leaves nothing active', () => {
    const e = blankEngine(all);
    const g = put(e, 'blue', { x: 4, y: 4 }, ['swordsman']);
    expect(executeCast(e, 'red', 'bolt', { kind: 'minion', id: g.minionIds[0] })).toBe('cast');
    expect(e.state.minions[g.minionIds[0]].hp).toBe(4);
    expect(e.state.spells).toHaveLength(0);
  });

  it('squanders when the target is already dead', () => {
    const e = blankEngine(all);
    const g = put(e, 'blue', { x: 4, y: 4 }, ['swordsman', 'archer']);
    const id = g.minionIds[0];
    killMinion(e, id, null, 'dies');
    expect(executeCast(e, 'red', 'bolt', { kind: 'minion', id })).toBe('squandered');
    expect(e.state.log.some((l) => l.type === 'squander')).toBe(true);
  });

  it('squanders when canCast fails', () => {
    const e = blankEngine(all);
    const g = put(e, 'blue', { x: 4, y: 4 }, ['swordsman']);
    expect(executeCast(e, 'red', 'picky', { kind: 'minion', id: g.minionIds[0] })).toBe('squandered');
  });

  it('makes alterations active and rejects an exclusive duplicate on the same host', () => {
    const e = blankEngine(all);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const ref = { kind: 'group' as const, id: g.id };
    expect(executeCast(e, 'red', 'ward', ref)).toBe('cast');
    expect(spellsOn(e.state, ref)).toHaveLength(1);
    expect(executeCast(e, 'red', 'ward', ref)).toBe('squandered');
    expect(spellsOn(e.state, ref)).toHaveLength(1);
  });

  it('summoning creates a computer-controlled monster group owned by the caster', () => {
    const e = blankEngine(all);
    expect(executeCast(e, 'red', 'wolves', { kind: 'square', pos: { x: 5, y: 5 } })).toBe('cast');
    const g = Object.values(e.state.groups)[0];
    expect(g.kind).toBe('monster');
    expect(g.control).toBe('computer');
    expect(g.owner).toBe('red');
    expect(g.botId).toBe('wolves');
  });

  it('ctx.draw draws for a side', () => {
    const e = gameEngine(all, ['bolt', 'bolt', 'bolt', 'bolt', 'bolt', 'bolt', 'bolt', 'bolt']);
    const before = e.state.players.red.hand.length;
    executeCast(e, 'red', 'draw2', { kind: 'globe' });
    expect(e.state.players.red.hand.length).toBe(before + 2);
  });
});

describe('persistence, dispel and expiry', () => {
  it('recheck dispels a spell whose persistent requirement fails', () => {
    const e = blankEngine(all);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const ref = { kind: 'group' as const, id: g.id };
    executeCast(e, 'red', 'ward', ref);
    e.state.terrain['4,4'] = 'water';
    recheck(e, ref);
    expect(spellsOn(e.state, ref)).toHaveLength(0);
  });

  it('dispelling one spell makes the host recheck the others', () => {
    const e = blankEngine(all);
    const globe = { kind: 'globe' as const };
    executeCast(e, 'red', 'b', globe);
    executeCast(e, 'red', 'needsB', globe);
    expect(e.state.spells).toHaveLength(2);
    dispel(e, e.state.spells.find((s) => s.cardId === 'b')!.id);
    expect(e.state.spells).toHaveLength(0);
  });

  it('conjuration duration counts the casting turn', () => {
    const e = blankEngine(all);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const ref = { kind: 'group' as const, id: g.id };
    executeCast(e, 'red', 'shield', ref);
    expireSpells(e);
    expect(spellsOn(e.state, ref)).toHaveLength(1);
    expect(spellsOn(e.state, ref)[0].turnsLeft).toBe(1);
    expireSpells(e);
    expect(spellsOn(e.state, ref)).toHaveLength(0);
  });
});
