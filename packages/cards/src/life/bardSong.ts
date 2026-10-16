import { Aura, card, Target } from '../lang';

export default card({ id: 'bard-song', name: 'Bard Song', house: 'life', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit, keywords: [Aura({ hand: 1 }, { to: 'swordsmen' })] });
