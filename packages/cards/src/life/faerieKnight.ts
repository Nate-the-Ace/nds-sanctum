import { card, Grant, Target, Warded } from '../lang';

// RULING: "enchantment" = a visible active spell on the attacker or on its group.
export default card({ id: 'faerie-knight', name: 'Faerie Knight', house: 'life', cost: { clarity: 4, world: 1 }, type: 'alteration',
  target: Target.recruit, keywords: [Warded(), Grant({ maxHp: 4 }, { heal: true })] });
