import { card, GiveSquares, OnCast, Target } from '../lang';

// RULING: the engine only lets square spells target empty squares, so the target forest square must be unoccupied.
export default card({ id: 'faerie-glade', name: 'Faerie Glade', house: 'life', cost: { clarity: 3, world: 3 }, type: 'manifestation',
  target: Target.square.on('forest'), keywords: [OnCast(GiveSquares('faerie-glade-square', 'forest'))] });
