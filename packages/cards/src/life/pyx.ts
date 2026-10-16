import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'pyx', name: 'Pyx', house: 'life', cost: { clarity: 1, world: 1 },
  type: 'manifestation', target: 'group',
  onCast: (c, t) => {
    if (t.kind !== 'group') return;
    for (const m of c.minionsOf(t.id)) c.heal(m.id, m.maxHp);
  },
});
