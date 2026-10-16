import { Afterward, card, Forbid, Lasts, Stackable, Target } from '../lang';

export default card({ id: 'court-politics', name: 'Court Politics', house: 'life', cost: { clarity: 3, world: 3 }, type: 'conjuration',
  target: Target.globe, keywords: [Lasts(3), Stackable(), Forbid(['group', 'individual'], { by: 'caster', friendly: true }), Afterward('court-politics-ii')] });
