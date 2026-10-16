import { card, MoveTwice, OnCast, Target } from '../lang';

export default card({ id: 'forced-march', name: 'Forced March', house: 'war', cost: { strife: 2, clarity: 1 }, type: 'manifestation',
  target: Target.recruitGroup, keywords: [OnCast(MoveTwice())] });
