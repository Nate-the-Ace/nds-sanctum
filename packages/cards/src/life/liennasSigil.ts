import { card, On, Target, When, Withdraw } from '../lang';

export default card({ id: 'liennas-sigil', name: "Lienna's Sigil", house: 'life', cost: { clarity: 3 }, type: 'alteration',
  target: Target.group, keywords: [On(When.startOfCombat('monster'), Withdraw())] });
