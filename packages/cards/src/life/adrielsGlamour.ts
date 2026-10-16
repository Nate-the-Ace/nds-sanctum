import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'adriels-glamour', name: "Adriel's Glamour", house: 'life', cost: { clarity: 2, world: 1 },
  type: 'conjuration', target: 'globe', duration: { turns: 5 },
  blocksCast: (_q, _sp, a) => a.card.target === 'globe',
});
