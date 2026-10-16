import { defineCard } from '@sanctum/engine';

// Helper spell cast on the globe when Court Politics expires.
export default defineCard({
  id: 'court-politics-ii', name: 'Court Politics II', house: 'life', cost: {},
  type: 'alteration', target: 'globe', helper: true, exclusive: false,
  on: {
    'mana:generate': (c) => {
      if (c.spell.owner !== 'neutral') c.addMana(c.spell.owner, 'clarity', 2);
    },
  },
});
