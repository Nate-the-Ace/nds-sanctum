import { card, Kill, OnCast, Target } from '../lang';

export default card({ id: 'good-of-the-many', name: 'Good of the Many', house: 'war', cost: { strife: 1 }, type: 'manifestation',
  target: Target.recruit.friendly, keywords: [OnCast(Kill('target'))] });
