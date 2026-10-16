import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'call-to-arms', name: 'Call to Arms', house: 'war', cost: { clarity: 5 },
  type: 'alteration', target: 'structure',
  on: {
    'mana:generate': (c) => {
      const st = c.host.kind === 'structure' ? c.structure(c.host.id) : undefined;
      if (st && st.owner !== 'neutral') c.addMana(st.owner, 'strife', 2);
    },
  },
});
