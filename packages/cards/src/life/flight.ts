import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'flight', name: 'Flight', house: 'life', cost: { clarity: 3, world: 1 },
  type: 'alteration', target: 'recruitGroup',
  stats: () => ({ walks: ['flight'] }),
});
