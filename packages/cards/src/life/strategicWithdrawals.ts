import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'strategic-withdrawals', name: 'Strategic Withdrawals', house: 'life', cost: { clarity: 4, world: 1 },
  type: 'alteration', target: 'globe',
  on: {
    'round:start': (c, ev) => {
      if (ev.data.round === 7) c.endCombat();
    },
  },
});
