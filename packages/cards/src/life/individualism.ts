import { card, Forbid, Lasts, Target } from '../lang';

export default card({ id: 'individualism', name: 'Individualism', house: 'life', cost: { clarity: 3, world: 2 }, type: 'conjuration',
  target: Target.globe, keywords: [Lasts(3), Forbid(['group'])] });
