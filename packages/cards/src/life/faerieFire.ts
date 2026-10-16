import { defineCard } from '@sanctum/engine';
import { groupHas, isHostGroup } from '../helpers';

export default defineCard({
  id: 'faerie-fire', name: 'Faerie Fire', house: 'life', cost: { clarity: 3 },
  type: 'alteration', target: 'recruitGroup',
  canCast: groupHas('archer'),
  stats: (q, id) => (q.minion(id)?.cls === 'archer' ? { missile: 2 } : {}),
  on: {
    'combat:after': (c, ev) => {
      if (isHostGroup(c, ev)) c.dispel();
    },
  },
});
