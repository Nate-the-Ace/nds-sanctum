import { defineCard } from '@sanctum/engine';
import { isCls } from '../helpers';

export default defineCard({
  id: 'marksman', name: 'Marksman', house: 'war', cost: { strife: 3, clarity: 2 },
  type: 'alteration', target: 'recruit',
  canCast: isCls('archer'),
  stats: () => ({ missile: 1, missileAttacks: 1, maxHp: 2 }),
  onCast: (c, t) => {
    if (t.kind === 'minion') c.heal(t.id, 2);
  },
});
