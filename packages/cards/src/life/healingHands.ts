import { card, Heal, On, Target, When } from '../lang';

export default card({ id: 'healing-hands', name: 'Healing Hands', house: 'life', cost: { clarity: 2 }, type: 'alteration',
  target: Target.recruit, keywords: [On(When.startOfTurn, Heal(1, 'hostGroup'))] });
