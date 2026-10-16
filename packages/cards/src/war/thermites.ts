import { card, Give, On, Target, When } from '../lang';

// RULING: the "ignores armor against Gargoyles" clause is omitted (no Gargoyles exist yet).
export default card({ id: 'thermites', name: 'Thermites', house: 'war', cost: { strife: 2 }, type: 'alteration',
  target: Target.recruit, keywords: [On(When.onHit, Give('thermite-damage', 'victim'))] });
