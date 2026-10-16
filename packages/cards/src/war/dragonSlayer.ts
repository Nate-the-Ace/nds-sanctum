import { defineCard } from '@sanctum/engine';
import { isCls, isHostMinion } from '../helpers';

export default defineCard({
  id: 'dragon-slayer', name: 'Dragon Slayer', house: 'war', cost: { strife: 3, clarity: 1 },
  type: 'alteration', target: 'recruit',
  canCast: isCls('archer'),
  on: {
    'attacker:damages': (c, ev) => {
      if (!isHostMinion(c, ev)) return;
      const victim = c.minion(ev.data.victimId);
      if (victim && victim.kind === 'monster') c.kill(victim.id);
    },
  },
});
