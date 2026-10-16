import { defineCard } from '@sanctum/engine';
import { groupHas, isHostGroup } from '../helpers';

export default defineCard({
  id: 'rain-of-arrows', name: 'Rain of Arrows', house: 'war', cost: { strife: 2, clarity: 1 },
  type: 'alteration', target: 'recruitGroup',
  canCast: groupHas('archer'),
  stats: (q, id) => (q.minion(id)?.cls === 'archer' ? { missileAttacks: 1 } : {}),
  on: {
    'combat:after': (c, ev) => {
      if (isHostGroup(c, ev)) c.dispel();
    },
  },
});
