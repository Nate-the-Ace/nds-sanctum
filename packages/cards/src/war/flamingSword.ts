import { defineCard } from '@sanctum/engine';
import { isCls } from '../helpers';

export default defineCard({
  id: 'flaming-sword', name: 'Flaming Sword', house: 'war', cost: { strife: 2 },
  type: 'alteration', target: 'recruit',
  canCast: isCls('swordsman'),
  stats: () => ({ hand: 2 }),
});
