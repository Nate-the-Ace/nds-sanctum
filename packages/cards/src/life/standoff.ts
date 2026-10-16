import { CancelMoves, card, Lasts, On, Target, When } from '../lang';

// "Turn of casting +1" = the casting turn and the next. RULING: computer-controlled recruit groups choose their own
// orders after "before movement" effects (rules: Pipelines/movement), so Standoff cannot stop them.
// RULING: relocation effects (Lienna's Steed) still work during Standoff, because the engine has no "cannot be moved" stat.
export default card({ id: 'standoff', name: 'Standoff', house: 'life', cost: { clarity: 3, world: 2 }, type: 'conjuration',
  target: Target.globe, keywords: [Lasts(2), On(When.beforeMovement, CancelMoves())] });
