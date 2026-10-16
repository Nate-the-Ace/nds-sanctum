import { card, Heal, On, Pacified, Target, When } from '../lang';

export default card({ id: 'vivant', name: 'Vivant', house: 'life', cost: { clarity: 5, world: 2 }, type: 'alteration',
  target: Target.recruit, keywords: [Pacified(), On(When.eachRound(), Heal(3, 'hostGroupHurtOther')), On(When.startOfTurn, Heal('full', 'hostGroup'))] });
