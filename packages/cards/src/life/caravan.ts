import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'caravan', name: 'Caravan', house: 'life', cost: { clarity: 1 },
  type: 'alteration', target: 'recruitGroup',
  stats: () => ({ walks: ['desert'] }),
});
