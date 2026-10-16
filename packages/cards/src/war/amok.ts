import { card, MoveTwice, OnCast, RandomMove, Target } from '../lang';

// RULING: the random direction is picked once and used for both moves.
export default card({ id: 'amok', name: 'Amok', house: 'war', cost: { strife: 4, clarity: 3 }, type: 'manifestation',
  target: Target.recruitGroup, keywords: [OnCast(MoveTwice(), RandomMove())] });
