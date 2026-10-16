import { card, Ramp, Target } from '../lang';

export default card({
  id: 'berserker-blade', name: 'Berserker Blade', house: 'war', cost: { strife: 2, clarity: 2 }, type: 'alteration',
  target: Target.swordsman, keywords: [Ramp('hit')],
});
