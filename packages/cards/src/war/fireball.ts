import { card, Damage, OnCast, Target } from '../lang';

export default card({ id: 'fireball', name: 'Fireball', house: 'war', cost: { strife: 4, clarity: 2 }, type: 'manifestation',
  target: Target.group, keywords: [OnCast(Damage(5, 'targetEach'))] });
