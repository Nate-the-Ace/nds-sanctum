import { defineCard } from '@sanctum/engine';

// RULING: "colony becomes town" is omitted: no colonies exist yet, so only the recruit bonus is implemented.
export default defineCard({
  id: 'auberols-grace', name: "Auberol's Grace", house: 'life', cost: { clarity: 6, world: 1 },
  type: 'alteration', target: 'structure',
  on: {
    'minion:created': (c, ev) => {
      c.createSpell('grace-of-auberol', { kind: 'minion', id: ev.data.minionId });
      c.heal(ev.data.minionId, 4);
    },
  },
});
