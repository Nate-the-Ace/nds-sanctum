import { card, Damage, Monster, On, Target, Territorial, When } from '../lang';

// RULING: the start-of-combat Fireball is raw magical damage from the Dragon, not a cast spell, so Shroud and
// Immune (which stop spells targeting a minion) do not stop it.
export default card({ id: 'brimstone-dragon', name: 'Brimstone Dragon', house: 'war', cost: { strife: 6, clarity: 3 }, type: 'summoning', host: 'minion',
  target: Target.square.on('mountain', 'volcano'),
  keywords: [
    Territorial(),
    Monster({ name: 'Brimstone Dragon', cls: 'monster', hand: 4, armor: 1, hp: 16, level: 2, walks: ['flight'] }),
    On(When.startOfCombat(), Damage(5, 'opponent')),
  ] });
