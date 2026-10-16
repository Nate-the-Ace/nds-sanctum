import { AddMana, card, On, Target, When } from '../lang';

export default card({ id: 'call-to-arms', name: 'Call to Arms', house: 'war', cost: { clarity: 5 }, type: 'alteration',
  target: Target.structure, keywords: [On(When.manaPhase, AddMana('strife', 2, 'structureOwner'))] });
