import { card, OnCast, Target, Terraform } from '../lang';

// RULING: the engine only lets square spells target empty squares, so the target forest square must be unoccupied.
export default card({ id: 'scorched-earth', name: 'Scorched Earth', house: 'war', cost: { strife: 2 }, type: 'manifestation',
  target: Target.square.on('forest'), keywords: [OnCast(Terraform('barren', 'contiguous', 'forest'))] });
