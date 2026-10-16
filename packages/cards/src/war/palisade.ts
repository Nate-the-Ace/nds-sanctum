import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'palisade', name: 'Palisade', house: 'war', cost: { strife: 2, clarity: 2 },
  type: 'alteration', target: 'square',
  stats: (q, id) => (q.minion(id)?.cls === 'archer' ? { armor: 1 } : {}),
});
