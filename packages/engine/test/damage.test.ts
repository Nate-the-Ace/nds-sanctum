import { describe, it, expect } from 'vitest';
import { defineCard, type CardDef } from '../src/cards';
import { applyDamage, takeDamage } from '../src/damage';
import { killMinion } from '../src/death';
import { addSpellRecord } from '../src/spellstore';
import { blankEngine, put } from './helpers';

const hand = { kind: 'hand' as const, ignoresArmor: false, magical: false };

function fresh(defs: CardDef[] = []) {
  const e = blankEngine(defs);
  const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
  const m = e.state.minions[g.minionIds[0]];
  m.combat.armor = 1;
  return { e, g, m };
}

const onMinion = (e: ReturnType<typeof blankEngine>, cardId: string, id: number) =>
  addSpellRecord(e.state, { cardId, owner: 'red', host: { kind: 'minion', id }, visible: true, turnsLeft: null, tokens: {} });

describe('takeDamage', () => {
  it('fully soaked damage bounces', () => {
    const { e, m } = fresh();
    expect(takeDamage(e, m.id, 1, hand, null)).toBe('bounced');
    expect(m.combat.armor).toBe(0);
    expect(m.hp).toBe(7);
  });

  it('excess damage reduces hit points', () => {
    const { e, m } = fresh();
    expect(takeDamage(e, m.id, 3, hand, null)).toBe('damaged');
    expect(m.hp).toBe(5);
  });

  it('lethal damage returns killed with hp 0', () => {
    const { e, m } = fresh();
    expect(takeDamage(e, m.id, 20, hand, null)).toBe('killed');
    expect(m.hp).toBe(0);
  });

  it('magical damage ignores armor, and a 0-point magical hit is "damaged"', () => {
    const { e, m } = fresh();
    expect(takeDamage(e, m.id, 2, { kind: 'spell', ignoresArmor: true, magical: true }, null)).toBe('damaged');
    expect(m.hp).toBe(5);
    expect(takeDamage(e, m.id, 0, { kind: 'spell', ignoresArmor: true, magical: true }, null)).toBe('damaged');
    expect(m.hp).toBe(5);
  });

  it('a beforeArmor handler can raise damage even from a 0-damage hit', () => {
    const despond = defineCard({
      id: 'despond', name: 'Despond', house: 'war', cost: {}, type: 'alteration', target: 'recruit',
      on: { 'attack:beforeArmor': (_c, ev) => { ev.data.damage += 3; } },
    });
    const { e, m } = fresh([despond]);
    onMinion(e, 'despond', m.id);
    expect(takeDamage(e, m.id, 0, hand, 99)).toBe('damaged'); // 3 - 1 armor = 2
    expect(m.hp).toBe(5);
  });

  it('an armor:after handler can cancel the damage', () => {
    const ward = defineCard({
      id: 'ward', name: 'Ward', house: 'war', cost: {}, type: 'alteration', target: 'recruit',
      on: { 'armor:after': (c) => c.cancel() },
    });
    const { e, m } = fresh([ward]);
    onMinion(e, 'ward', m.id);
    expect(takeDamage(e, m.id, 5, hand, null)).toBe('bounced');
    expect(m.hp).toBe(7);
  });
});

describe('applyDamage and death', () => {
  it('applyDamage({ magical:false }) respects armor; the default ignores it', () => {
    const a = fresh();
    applyDamage(a.e, a.m.id, 2, { magical: false });
    expect(a.m.hp).toBe(6);
    const b = fresh();
    applyDamage(b.e, b.m.id, 2);
    expect(b.m.hp).toBe(5);
  });

  it('spell damage kills, buries and empties the group', () => {
    const { e, g, m } = fresh();
    applyDamage(e, m.id, 20);
    expect(m.status).toBe('dead');
    expect(e.state.groups[g.id]).toBeUndefined();
    expect(e.state.graveyard).toContain(m.id);
  });

  it('a dying handler can cancel death while hp is positive', () => {
    const phoenix = defineCard({
      id: 'phoenix', name: 'Phoenix', house: 'war', cost: {}, type: 'alteration', target: 'recruit',
      on: { 'minion:dying': (c) => c.cancel() },
    });
    const { e, m } = fresh([phoenix]);
    onMinion(e, 'phoenix', m.id);
    m.hp = 3;
    expect(killMinion(e, m.id, null, 'dies')).toBe('cancelled');
    expect(m.status).toBe('alive');
  });

  it('kills fires killed then dies; dies fires only dies; burial removes minion spells', () => {
    const seen: string[] = [];
    const watcher = defineCard({
      id: 'watch', name: 'Watch', house: 'war', cost: {}, type: 'alteration', target: 'recruit',
      on: {
        'minion:killed': () => { seen.push('killed'); },
        'minion:dies': () => { seen.push('dies'); },
      },
    });
    const a = fresh([watcher]);
    onMinion(a.e, 'watch', a.m.id);
    killMinion(a.e, a.m.id, 77, 'kills');
    expect(seen).toEqual(['killed', 'dies']);
    expect(a.e.state.spells).toHaveLength(0);

    seen.length = 0;
    const b = fresh([watcher]);
    onMinion(b.e, 'watch', b.m.id);
    killMinion(b.e, b.m.id, null, 'dies');
    expect(seen).toEqual(['dies']);
  });

  it('removed-from-game skips events', () => {
    const seen: string[] = [];
    const watcher = defineCard({
      id: 'watch', name: 'Watch', house: 'war', cost: {}, type: 'alteration', target: 'recruit',
      on: { 'minion:dies': () => { seen.push('dies'); } },
    });
    const { e, m } = fresh([watcher]);
    onMinion(e, 'watch', m.id);
    killMinion(e, m.id, null, 'removed');
    expect(seen).toEqual([]);
    expect(m.status).toBe('dead');
  });
});
