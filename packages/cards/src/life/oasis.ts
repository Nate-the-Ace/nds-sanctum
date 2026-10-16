import { card, Heal, On, OnCast, Target, Terraform, When } from '../lang';

export default card({ id: 'oasis', name: 'Oasis', house: 'life', cost: { clarity: 3, world: 1 }, type: 'alteration',
  target: Target.structure, keywords: [OnCast(Terraform('desert', 'adjacent')), On(When.startOfTurn, Heal(1, 'hostOccupants'))] });
