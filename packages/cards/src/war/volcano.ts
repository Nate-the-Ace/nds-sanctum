import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'volcano', name: 'Volcano', house: 'war', cost: { strife: 4, clarity: 3 },
  type: 'manifestation', target: 'square',
  onCast: (c, t) => {
    if (t.kind === 'square') c.setTerrain(t.pos, 'volcano');
  },
});
