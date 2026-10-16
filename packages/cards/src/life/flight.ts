import { card, Target, Walk } from '../lang';

export default card({ id: 'flight', name: 'Flight', house: 'life', cost: { clarity: 3, world: 1 }, type: 'alteration',
  target: Target.recruitGroup, keywords: [Walk('flight')] });
