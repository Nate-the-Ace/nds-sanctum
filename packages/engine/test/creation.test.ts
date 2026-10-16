import { describe, it, expect } from 'vitest';
import { defineCard, indexCards, type CardDef } from '../src/cards';
import { executeCast } from '../src/spells';
import { resolveTurn } from '../src/turn';
import { addSpellRecord } from '../src/spellstore';
import { recruitSpec } from '../src/units';
import { RULES } from '../src/rules';
import type { Structure } from '../src/types';
import { blankEngine, gameEngine, put } from './helpers';

const town = (id: number, owner: 'red' | 'blue', x: number, y: number): Structure => ({
  id, kind: 'town', pos: { x, y }, owner, manaType: null, novices: 0, turnCount: 2, captured: false,
});
const probe = (fn: CardDef['onCast']): CardDef =>
  defineCard({ id: 'probe', name: 'probe', house: 'war', cost: {}, type: 'manifestation', target: 'globe', onCast: fn });
const globe = { kind: 'globe' as const };

describe('addMinion', () => {
  it('adds to a group until it is full', () => {
    let first: number | null = -1;
    let overflow: number | null = -1;
    const e = blankEngine([probe((c) => {
      const gid = Object.keys(c.state.groups).map(Number)[0];
      first = c.addMinion(gid, recruitSpec('swordsman', 'human'));
      overflow = c.addMinion(gid, recruitSpec('swordsman'));
    })]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman', 'swordsman', 'swordsman', 'swordsman', 'swordsman', 'swordsman']);
    executeCast(e, 'red', 'probe', globe);
    expect(first).not.toBeNull();
    expect(e.state.groups[g.id].minionIds).toHaveLength(RULES.maxGroup);
    expect(e.state.minions[first!].nation).toBe('human');
    expect(overflow).toBeNull();
  });
});

describe('createRecruit', () => {
  it('joins the friendly group on the structure, or starts one; refuses a hostile occupant', () => {
    const ids: Array<number | null> = [];
    const e = blankEngine([probe((c) => {
      ids.push(c.createRecruit(10, recruitSpec('swordsman')));
      ids.push(c.createRecruit(11, recruitSpec('swordsman')));
      ids.push(c.createRecruit(12, recruitSpec('swordsman')));
    })]);
    e.state.structures[10] = town(10, 'red', 3, 3);
    e.state.structures[11] = town(11, 'red', 6, 6);
    e.state.structures[12] = town(12, 'red', 8, 2);
    const mine = put(e, 'red', { x: 3, y: 3 }, ['archer']);
    put(e, 'blue', { x: 8, y: 2 }, ['archer']);
    executeCast(e, 'red', 'probe', globe);
    expect(e.state.groups[mine.id].minionIds).toHaveLength(2);
    expect(ids[0]).not.toBeNull();
    expect(Object.values(e.state.groups).find((g) => g.pos?.x === 6 && g.pos?.y === 6)?.minionIds).toHaveLength(1);
    expect(ids[2]).toBeNull();
  });

  it('dispatches minion:created on the structure', () => {
    const watch = defineCard({
      id: 'watch', name: 'watch', house: 'war', cost: {}, type: 'alteration', target: 'structure', visible: false,
      on: { 'minion:created': (c, ev) => c.setToken('seen', ev.data.minionId) },
    });
    const e = blankEngine([watch, probe((c) => { c.createRecruit(10, recruitSpec('archer')); })]);
    e.state.structures[10] = town(10, 'red', 3, 3);
    const sp = addSpellRecord(e.state, { cardId: 'watch', owner: 'red', host: { kind: 'structure', id: 10 }, visible: false, turnsLeft: null, tokens: {} });
    executeCast(e, 'red', 'probe', globe);
    expect(sp.tokens.seen).toBeGreaterThan(0);
  });
});

describe('novices', () => {
  it('addNovices caps at the maximum and training uses the queued nation first', () => {
    const e = gameEngine([probe((c) => {
      const sid = Object.values(c.state.structures).find((s) => s.kind === 'sanctum' && s.owner === 'red')!.id;
      c.addNovices(sid, 2, 'elf');
      c.addNovices(sid, 99, 'dwarf');
    })]);
    executeCast(e, 'red', 'probe', globe);
    const sanctum = Object.values(e.state.structures).find((s) => s.kind === 'sanctum' && s.owner === 'red')!;
    expect(sanctum.novices).toBe(RULES.maxNovices);
    expect(sanctum.noviceNations).toEqual(['elf', 'elf', 'dwarf', 'dwarf', 'dwarf']);
    // train one swordsman: it is an elf
    e.state.players.red.orders = { train: [{ structureId: sanctum.id, as: 'swordsman' }], cast: [], move: [], discard: null };
    const before = new Set(Object.keys(e.state.minions));
    resolveTurn(e);
    const fresh = Object.values(e.state.minions).filter((m) => !before.has(String(m.id)) && m.owner === 'red');
    expect(fresh[0].nation).toBe('elf');
    expect(e.state.structures[sanctum.id].noviceNations).toEqual(['elf', 'dwarf', 'dwarf', 'dwarf']);
  });
});

describe('changeSides', () => {
  it('flips the group, its minions and the spells on them', () => {
    const mark = defineCard({ id: 'mark', name: 'mark', house: 'war', cost: {}, type: 'alteration', target: 'recruit' });
    const e = blankEngine([mark, probe((c) => { c.changeSides(Object.keys(c.state.groups).map(Number)[0]); })]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const sp = addSpellRecord(e.state, { cardId: 'mark', owner: 'red', host: { kind: 'minion', id: g.minionIds[0] }, visible: true, turnsLeft: null, tokens: {} });
    executeCast(e, 'red', 'probe', globe);
    expect(e.state.groups[g.id].owner).toBe('blue');
    expect(e.state.minions[g.minionIds[0]].owner).toBe('blue');
    expect(sp.owner).toBe('blue');
    expect(e.state.groupSeq.red).not.toContain(g.id);
    expect(e.state.groupSeq.blue).toContain(g.id);
  });
});

describe('createSpell tokens', () => {
  it('sets initial tokens', () => {
    const watch = defineCard({ id: 'watch', name: 'watch', house: 'war', cost: {}, type: 'alteration', target: 'globe', visible: false });
    const e = blankEngine([watch, probe((c) => { c.createSpell('watch', globe, { tokens: { gid: 7 } }); })]);
    executeCast(e, 'red', 'probe', globe);
    expect(e.state.spells.find((s) => s.cardId === 'watch')?.tokens.gid).toBe(7);
  });
});
