import { defineCard } from '@sanctum/engine';
import { isCls } from '../helpers';

export default defineCard({
  id: 'bloodlust', name: 'Bloodlust', house: 'war', cost: { strife: 2, clarity: 1 },
  type: 'alteration', target: 'recruit',
  canCast: isCls('swordsman'),
  stats: () => ({ handAttacks: 1 }),
});
