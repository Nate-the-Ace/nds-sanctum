import { defineCard } from '@sanctum/engine';
import { isHostGroup } from '../helpers';

export default defineCard({
  id: 'skirmish', name: 'Skirmish', house: 'war', cost: { strife: 1 },
  type: 'alteration', target: 'group',
  on: {
    'round:start': (c, ev) => {
      if (ev.data.round === 3 && isHostGroup(c, ev)) c.endCombat();
    },
    'combat:after': (c, ev) => {
      if (isHostGroup(c, ev)) c.dispel();
    },
  },
});
