import { card, Grant, Target, Warded } from '../lang';

// RULING: "enchantment" = a visible active spell on the attacker or on its group.
export default card({ id: 'filigreed-armor', name: 'Filigreed Armor', house: 'life', cost: { clarity: 2, world: 1 }, type: 'alteration',
  target: Target.recruit, keywords: [Warded(1), Grant({ armor: 1 })] });
