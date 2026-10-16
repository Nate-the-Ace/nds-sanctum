import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'vivant', name: 'Vivant', house: 'life', cost: { clarity: 5, world: 2 },
  type: 'alteration', target: 'recruit',
  stats: () => ({ handAttacks: -9, missileAttacks: -9, noDamage: true }),
  on: {
    'round:start': (c, ev) => {
      if (c.host.kind !== 'minion' || ev.ref?.kind !== 'group') return;
      const me = c.minion(c.host.id);
      if (!me || me.groupId !== ev.ref.id) return;
      const hurt = c
        .minionsOf(me.groupId)
        .filter((m) => m.id !== me.id && m.kind === 'recruit' && m.hp < m.maxHp)
        .sort((a, b) => b.maxHp - b.hp - (a.maxHp - a.hp))[0];
      if (hurt) c.heal(hurt.id, 3);
    },
    'turn:start': (c) => {
      if (c.host.kind !== 'minion') return;
      const me = c.minion(c.host.id);
      if (!me) return;
      for (const m of c.minionsOf(me.groupId)) c.heal(m.id, m.maxHp);
    },
  },
});
