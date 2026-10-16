import { card, On, Target, When, Withdraw } from '../lang';

export default card({ id: 'strategic-withdrawals', name: 'Strategic Withdrawals', house: 'life', cost: { clarity: 4, world: 1 }, type: 'alteration',
  target: Target.globe, keywords: [On(When.eachRound(7), Withdraw())] });
