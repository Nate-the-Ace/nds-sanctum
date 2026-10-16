import { Against, card, Immune, Monster, Nomadic, Target } from '../lang';

export default card({ id: 'prismatic-serpent', name: 'Prismatic Serpent', house: 'life', cost: { clarity: 5, world: 3 }, type: 'summoning', host: 'minion',
  target: Target.square,
  keywords: [
    Nomadic(),
    Monster({ name: 'Prismatic Serpent', cls: 'monster', hand: 4, armor: 2, hp: 12, level: 2 }),
    Against(['death', 'despair'], { hand: 4, monstersOnly: true }),
    Immune(['death', 'despair']),
  ] });
