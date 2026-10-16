import { card, Pacified, Target } from '../lang';

export default card({ id: 'pacifism', name: 'Pacifism', house: 'life', cost: { clarity: 2, world: 1 }, type: 'alteration',
  target: Target.recruit, keywords: [Pacified()] });
