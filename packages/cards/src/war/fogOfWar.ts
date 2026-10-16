import { defineCard } from '@sanctum/engine';
import { INDIVIDUAL_TARGETS } from '../helpers';

export default defineCard({
  id: 'fog-of-war', name: 'Fog of War', house: 'war', cost: { strife: 3, clarity: 2 },
  type: 'conjuration', target: 'globe', duration: { turns: 3 },
  blocksCast: (_q, _sp, a) => INDIVIDUAL_TARGETS.includes(a.card.target) && !a.card.ignoresConcealment,
});
