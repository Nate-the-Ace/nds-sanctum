import { card, Give, Lasts, On, Target, When } from '../lang';

export default card({ id: 'clandestine', name: 'Clandestine', house: 'life', cost: { clarity: 3, world: 2 }, type: 'conjuration',
  target: Target.structure, keywords: [Lasts(5), On(When.created, Give('greymantle', 'created'))] });
