import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { fight } from '../src/combat';
import { executeCast } from '../src/spells';
import { addSpellRecord } from '../src/spellstore';
import { createGroup, recruitSpec, spawnMinion } from '../src/units';
import type { MinionSpec } from '../src/types';
import { blankEngine, put } from './helpers';

const dummy = (armor = 0): MinionSpec => ({
  kind: 'monster', cls: 'monster', name: 'dummy',
  base: { hp: 100, level: 1, armor, hand: 0, handAttacks: 0, missile: 0, missileAttacks: 0, walks: [] },
});
const strikeFlag = (id: string, flag: 'magical' | 'heals') => defineCard({
  id, name: id, house: 'war', cost: {}, type: 'alteration', target: 'recruit',
  on: {
    'attacker:strikes': (c, ev) => {
      if (ev.ref?.kind === 'minion' && c.host.kind === 'minion' && ev.ref.id === c.host.id) ev.data[flag] = true;
    },
  },
});

/** A red swordsman (with `cardId` on it, if given) fights a 100-hp dummy; returns the dummy's hit points. */
function duel(cardId: string | null, armor: number, startHp = 100): number {
  const e = blankEngine([strikeFlag('magic', 'magical'), strikeFlag('mend', 'heals')]);
  const a = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
  if (cardId) addSpellRecord(e.state, { cardId, owner: 'red', host: { kind: 'minion', id: a.minionIds[0] }, visible: false, turnsLeft: null, tokens: {} });
  const b = createGroup(e, 'blue', { x: 5, y: 4 }, 'monster', 'computer');
  const v = spawnMinion(e, b.id, dummy(armor));
  e.state.minions[v.id].hp = startHp;
  fight(e, a.id, b.id);
  return e.state.minions[v.id].hp;
}

describe('magical strikes', () => {
  it('ignore armor', () => {
    // 9 hand attacks (rounds 2-10) of 2 damage; armor 1 soaks 1 of each unless the attack is magical
    expect(duel(null, 1)).toBe(100 - 9);
    expect(duel('magic', 1)).toBe(100 - 18);
  });
});

describe('healing strikes', () => {
  it('heal what gets through armor, up to the maximum', () => {
    expect(duel('mend', 0, 50)).toBe(68);
    expect(duel('mend', 1, 50)).toBe(59);
    expect(duel('mend', 0, 95)).toBe(100);
  });
});

describe('ctx.setNation', () => {
  it('changes nation, house, nation hit points and nation walks', () => {
    const toElf = defineCard({
      id: 'to-elf', name: 'to-elf', house: 'life', cost: {}, type: 'manifestation', target: 'recruit',
      onCast: (c, t) => { if (t.kind === 'minion') c.setNation(t.id, 'elf'); },
    });
    const e = blankEngine([toElf]);
    const g = createGroup(e, 'red', { x: 4, y: 4 }, 'recruit', 'player');
    const cy = spawnMinion(e, g.id, recruitSpec('swordsman', 'cyclops'));
    const dw = spawnMinion(e, g.id, recruitSpec('swordsman', 'dwarf'));
    expect(executeCast(e, 'red', 'to-elf', { kind: 'minion', id: cy.id })).toBe('cast');
    expect(e.state.minions[cy.id]).toMatchObject({ nation: 'elf', house: 'life', hp: 7, maxHp: 7 });
    executeCast(e, 'red', 'to-elf', { kind: 'minion', id: dw.id });
    expect(e.state.minions[dw.id].base.walks).toEqual([]);
    expect(e.state.minions[dw.id].nation).toBe('elf');
  });
});
