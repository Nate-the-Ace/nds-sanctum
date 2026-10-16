import { card, Expend, Heal, On, Target, When } from '../lang';

export default card({ id: 'wellspring', name: 'Wellspring', house: 'life', cost: { clarity: 4, world: 1 }, type: 'alteration',
  target: Target.square, keywords: [On(When.enter('recruit'), Heal('full', 'allBoard'), Expend())] });
