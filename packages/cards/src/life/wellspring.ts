import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'wellspring', name: 'Wellspring', house: 'life', cost: { clarity: 4, world: 1 },
  type: 'alteration', target: 'square',
  on: {
    'group:enter': (c, ev) => {
      const g = ev.ref?.kind === 'group' ? c.group(ev.ref.id) : undefined;
      if (!g || g.kind !== 'recruit') return;
      for (const m of Object.values(c.state.minions)) {
        if (m.status === 'alive' && c.group(m.groupId)?.pos) c.heal(m.id, m.maxHp);
      }
      c.dispel();
    },
  },
});
