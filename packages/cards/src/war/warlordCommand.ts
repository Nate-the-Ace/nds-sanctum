import { Aura, card, Target } from '../lang';

export default card({ id: 'warlord-command', name: 'Warlord Command', house: 'war', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit, keywords: [Aura({ hand: 1 }, { to: 'swordsmen', self: { hand: 3 } })] });
