import { card, Grant, Target } from '../lang';

// Helper spell: created on each member of a group that enters a Fountain of Youth.
export default card({ id: 'youth', name: 'Youth', house: 'life', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit, keywords: [Grant({ level: -1 })] });
