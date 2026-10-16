import { card, Monster, Target, Territorial, Warded } from '../lang';

export default card({ id: 'sylph', name: 'Sylph', house: 'life', cost: { clarity: 6, world: 2 }, type: 'summoning', host: 'minion',
  target: Target.square,
  keywords: [Territorial(), Monster({ name: 'Sylph', cls: 'monster', missile: 3, missileAttacks: 2, hp: 15, level: 1 }), Warded()] });
