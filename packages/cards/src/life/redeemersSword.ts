import { card, Grant, Target } from '../lang';

// RULING: the original adds +4 damage against Death or Despair monsters and protects against Death/Despair
// individual spells. No such cards exist yet, so only the unconditional +2 is implemented.
export default card({ id: 'redeemers-sword', name: "Redeemer's Sword", house: 'life', cost: { clarity: 2, world: 1 }, type: 'alteration',
  target: Target.swordsman, keywords: [Grant({ hand: 2 })] });
