import { defineCard } from '@sanctum/engine';
import { isCls } from '../helpers';

// RULING: the original adds +4 damage against Death or Despair monsters and protects against Death/Despair
// individual spells. No such cards exist yet, so only the unconditional +2 is implemented.
export default defineCard({
  id: 'redeemers-sword', name: "Redeemer's Sword", house: 'life', cost: { clarity: 2, world: 1 },
  type: 'alteration', target: 'recruit',
  canCast: isCls('swordsman'),
  stats: () => ({ hand: 2 }),
});
