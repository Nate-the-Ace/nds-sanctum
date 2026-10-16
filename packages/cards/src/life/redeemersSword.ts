import { card, Grant, Target } from '../lang';

export default card({ id: 'redeemers-sword', name: "Redeemer's Sword", house: 'life', cost: { clarity: 2, world: 1 }, type: 'alteration',
  target: Target.swordsman, keywords: [Grant({ hand: 2 })] });
