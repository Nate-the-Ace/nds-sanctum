import { card, Damage, Monster, On, Target, Territorial, When } from '../lang';

export default card({ id: 'brimstone-dragon', name: 'Brimstone Dragon', house: 'war', cost: { strife: 6, clarity: 3 }, type: 'summoning', host: 'minion',
  target: Target.square.on('mountain', 'volcano'),
  keywords: [
    Territorial(),
    Monster({ name: 'Brimstone Dragon', cls: 'monster', hand: 4, armor: 1, hp: 16, level: 2, walks: ['flight'] }),
    On(When.startOfCombat(), Damage(5, 'opponent')),
  ] });
