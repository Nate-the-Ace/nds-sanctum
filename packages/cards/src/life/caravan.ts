import { card, Target, Walk } from '../lang';

export default card({ id: 'caravan', name: 'Caravan', house: 'life', cost: { clarity: 1 }, type: 'alteration',
  target: Target.recruitGroup, keywords: [Walk('desert')] });
