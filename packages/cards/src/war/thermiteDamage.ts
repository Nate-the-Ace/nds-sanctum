import { card, Grant, Target } from '../lang';

// Helper spell: created on a victim by Thermites. Cumulative (createSpell ignores exclusivity).
export default card({ id: 'thermite-damage', name: 'Thermite Damage', house: 'war', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit, keywords: [Grant({ armor: -1 })] });
