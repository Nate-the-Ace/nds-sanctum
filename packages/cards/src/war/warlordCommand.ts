import { Aura, card, Target, Undispellable } from '../lang';

// RULING: non-dispellable identity helper (see decoyRuse.ts).

export default card({ id: 'warlord-command', name: 'Warlord Command', house: 'war', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit, keywords: [Undispellable(), Aura({ hand: 1 }, { to: 'swordsmen', self: { hand: 3 } })] });
