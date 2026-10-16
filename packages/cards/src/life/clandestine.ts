import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'clandestine', name: 'Clandestine', house: 'life', cost: { clarity: 3, world: 2 },
  type: 'conjuration', target: 'structure', duration: { turns: 5 },
  on: {
    'minion:created': (c, ev) => {
      c.createSpell('greymantle', { kind: 'minion', id: ev.data.minionId });
    },
  },
});
