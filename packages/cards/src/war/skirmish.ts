import { card, Fleeting, On, Target, When, Withdraw } from '../lang';

export default card({ id: 'skirmish', name: 'Skirmish', house: 'war', cost: { strife: 1 }, type: 'alteration',
  target: Target.group, keywords: [Fleeting(), On(When.eachRound(3), Withdraw())] });
