import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'fireball', name: 'Fireball', house: 'war', cost: { strife: 4, clarity: 2 },
  type: 'manifestation', target: 'group',
  onCast: (c, t) => {
    if (t.kind !== 'group') return;
    const ids = c.minionsOf(t.id).map((m) => m.id);
    for (const id of ids) c.damage(id, 5);
  },
});
