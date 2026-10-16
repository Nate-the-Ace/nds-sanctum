import { card, Kill, On, Target, When } from '../lang';

export default card({ id: 'dragon-slayer', name: 'Dragon Slayer', house: 'war', cost: { strife: 3, clarity: 1 }, type: 'alteration',
  target: Target.archer, keywords: [On(When.onDamage('monster'), Kill('victim'))] });
