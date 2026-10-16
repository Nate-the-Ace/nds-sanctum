import { AddMana, card, On, Target, When } from '../lang';

export default card({ id: 'ring-of-light', name: 'Ring of Light', house: 'life', cost: { world: 5 }, type: 'alteration',
  target: Target.structure, keywords: [On(When.manaPhase, AddMana('clarity', 2, 'structureOwner'))] });
