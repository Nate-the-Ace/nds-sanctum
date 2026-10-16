import { card, Forbid, Lasts, Target } from '../lang';

export default card({ id: 'adriels-glamour', name: "Adriel's Glamour", house: 'life', cost: { clarity: 2, world: 1 }, type: 'conjuration',
  target: Target.globe, keywords: [Lasts(5), Forbid(['globe'])] });
