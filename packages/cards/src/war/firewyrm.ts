import { Ambush, card, Stackable, Target } from '../lang';

export default card({ id: 'firewyrm', name: 'Firewyrm', house: 'war', cost: { strife: 3, clarity: 2 }, type: 'summoning', host: 'minion',
  target: Target.globe,
  keywords: [
    Stackable(),
    Ambush({ name: 'Firewyrm', cls: 'monster', hand: 2, handAttacks: 2, hp: 12, level: 1 }, { terrain: ['lava', 'barren'], next: 'any', becomes: 'lava' }),
  ] });
