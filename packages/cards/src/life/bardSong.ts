import { Aura, card, Target, Undispellable } from '../lang';

// RULING: non-dispellable identity helper (see decoyRuse.ts).

export default card({ id: 'bard-song', name: 'Bard Song', house: 'life', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit, keywords: [Undispellable(), Aura({ hand: 1 }, { to: 'swordsmen' })] });
