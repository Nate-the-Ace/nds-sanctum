import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'aura-of-world', name: 'Aura of World', house: 'life', cost: { clarity: 4 },
  type: 'alteration', target: 'globe', exclusive: false,
  on: {
    'mana:generate': (c) => {
      if (c.spell.owner !== 'neutral') c.addMana(c.spell.owner, 'world', 1);
    },
  },
});
