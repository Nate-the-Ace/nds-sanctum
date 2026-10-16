import { defineCard } from '@sanctum/engine';
import { isFriendlyMinion } from '../helpers';

export default defineCard({
  id: 'good-of-the-many', name: 'Good of the Many', house: 'war', cost: { strife: 1 },
  type: 'manifestation', target: 'recruit',
  canCast: isFriendlyMinion,
  onCast: (c, t) => {
    if (t.kind === 'minion') c.kill(t.id);
  },
});
