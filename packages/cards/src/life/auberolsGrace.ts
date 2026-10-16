import { card, Give, Heal, On, Target, When } from '../lang';

// RULING: "colony becomes town" is omitted: no colonies exist yet, so only the recruit bonus is implemented.
export default card({ id: 'auberols-grace', name: "Auberol's Grace", house: 'life', cost: { clarity: 6, world: 1 }, type: 'alteration',
  target: Target.structure, keywords: [On(When.created, Give('grace-of-auberol', 'created'), Heal(4, 'created'))] });
