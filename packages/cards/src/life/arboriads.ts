import { Against, Ambush, card, Stackable, Target } from '../lang';

export default card({ id: 'arboriads', name: 'Arboriads', house: 'life', cost: { clarity: 3, world: 2 }, type: 'summoning', host: 'minion',
  target: Target.globe,
  keywords: [
    Stackable(),
    Ambush({ name: 'Arboriads', cls: 'monster', hand: 3, armor: 1, hp: 7, level: 1 }, { terrain: ['forest'], next: 'recruit', count: 2 }),
    Against(['death'], { hand: 4 }),
  ] });
