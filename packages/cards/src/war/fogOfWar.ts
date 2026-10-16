import { card, Concealment, Lasts, Target } from '../lang';

export default card({ id: 'fog-of-war', name: 'Fog of War', house: 'war', cost: { strife: 3, clarity: 2 }, type: 'conjuration',
  target: Target.globe, keywords: [Lasts(3), Concealment()] });
