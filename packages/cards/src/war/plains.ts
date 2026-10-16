import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'plains', name: 'Plains', house: 'war', cost: { strife: 3 },
  type: 'manifestation', target: 'square',
  onCast: (c, t) => {
    if (t.kind === 'square') c.setTerrain(t.pos, 'plains');
  },
});
