import { defineCard } from '@sanctum/engine';

// RULING: the random direction is picked once and used for both moves.
export default defineCard({
  id: 'amok', name: 'Amok', house: 'war', cost: { strife: 4, clarity: 3 },
  type: 'manifestation', target: 'recruitGroup',
  onCast: (c, t) => {
    if (t.kind !== 'group') return;
    c.setMovesTwice(t.id);
    if (c.group(t.id)?.control === 'player') {
      const dirs = c.legalDirections(t.id);
      if (dirs.length > 0) c.setMoveOrder(t.id, dirs[Math.floor(c.random() * dirs.length)]);
    }
  },
});
