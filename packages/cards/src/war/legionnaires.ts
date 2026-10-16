import { defineCard } from '@sanctum/engine';
import { groupHas } from '../helpers';

export default defineCard({
  id: 'legionnaires', name: 'Legionnaires', house: 'war', cost: { strife: 3, clarity: 1 },
  type: 'alteration', target: 'recruitGroup',
  canCast: groupHas('swordsman'),
  stats: (q, id) => (q.minion(id)?.cls === 'swordsman' ? { hand: 1 } : {}),
});
