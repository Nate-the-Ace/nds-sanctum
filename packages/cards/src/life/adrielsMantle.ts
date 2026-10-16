import { card, Lasts, Shroud, Target } from '../lang';

export default card({ id: 'adriels-mantle', name: "Adriel's Mantle", house: 'life', cost: { clarity: 2, world: 1 }, type: 'conjuration',
  target: Target.group, keywords: [Lasts(2), Shroud()] });
