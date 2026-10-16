import { card, Give, Heal, On, Target, When } from '../lang';

// RULING: repeated entries heal fully again but do not add more levels; each minion carries at most one Youth.
export default card({ id: 'fountain-of-youth', name: 'Fountain of Youth', house: 'life', cost: { clarity: 3, world: 1 }, type: 'alteration',
  target: Target.square, keywords: [On(When.enter(), Heal('full', 'enterer'), Give('youth', 'enterer', true))] });
