import { AddMana, card, On, Stackable, Target, When } from '../lang';

export default card({ id: 'aura-of-world', name: 'Aura of World', house: 'life', cost: { clarity: 4 }, type: 'alteration',
  target: Target.globe, keywords: [Stackable(), On(When.manaPhase, AddMana('world', 1))] });
