import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'ngozis-way', name: "Ngozi's Way", house: 'war', cost: { strife: 5, clarity: 1 },
  type: 'alteration', target: 'recruitGroup',
  stats: () => ({ level: 1 }),
});
