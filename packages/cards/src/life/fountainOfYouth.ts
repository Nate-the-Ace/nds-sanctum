import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'fountain-of-youth', name: 'Fountain of Youth', house: 'life', cost: { clarity: 3, world: 1 },
  type: 'alteration', target: 'square',
  on: {
    'group:enter': (c, ev) => {
      const g = ev.ref?.kind === 'group' ? c.group(ev.ref.id) : undefined;
      if (!g) return;
      for (const m of c.minionsOf(g.id)) {
        c.heal(m.id, m.maxHp);
        c.createSpell('youth', { kind: 'minion', id: m.id });
      }
    },
  },
});
