import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'ring-of-light', name: 'Ring of Light', house: 'life', cost: { world: 5 },
  type: 'alteration', target: 'structure',
  on: {
    'mana:generate': (c) => {
      const st = c.host.kind === 'structure' ? c.structure(c.host.id) : undefined;
      if (st && st.owner !== 'neutral') c.addMana(st.owner, 'clarity', 2);
    },
  },
});
