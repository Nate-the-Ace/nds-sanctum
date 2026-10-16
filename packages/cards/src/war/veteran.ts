import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'veteran', name: 'Veteran', house: 'war', cost: { strife: 3 },
  type: 'alteration', target: 'recruit',
  stats: () => ({ hand: 1, armor: 1, maxHp: 4 }),
  onCast: (c, t) => {
    if (t.kind === 'minion') c.heal(t.id, 4);
  },
});
