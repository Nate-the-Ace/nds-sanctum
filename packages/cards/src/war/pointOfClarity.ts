import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'point-of-clarity', name: 'Point of Clarity', house: 'war', cost: { strife: 4 },
  type: 'alteration', target: 'globe', exclusive: false,
  on: {
    'mana:generate': (c) => {
      if (c.spell.owner !== 'neutral') c.addMana(c.spell.owner, 'clarity', 1);
    },
  },
});
