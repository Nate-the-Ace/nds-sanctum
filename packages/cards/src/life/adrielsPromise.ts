import { card, Forbid, Lasts, Target } from '../lang';

export default card({ id: 'adriels-promise', name: "Adriel's Promise", house: 'life', cost: { clarity: 3, world: 2 }, type: 'conjuration',
  target: Target.globe, keywords: [Lasts(8), Forbid(['structure'])] });
