import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'forced-march', name: 'Forced March', house: 'war', cost: { strife: 2, clarity: 1 },
  type: 'manifestation', target: 'recruitGroup',
  onCast: (c, t) => {
    if (t.kind === 'group') c.setMovesTwice(t.id);
  },
});
