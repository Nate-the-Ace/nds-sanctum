import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'adriels-promise', name: "Adriel's Promise", house: 'life', cost: { clarity: 3, world: 2 },
  type: 'conjuration', target: 'globe', duration: { turns: 8 },
  blocksCast: (_q, _sp, a) => a.card.target === 'structure',
});
