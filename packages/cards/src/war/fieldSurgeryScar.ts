import { card, Grant, Target, Undispellable } from '../lang';

// Helper spell: permanent (non-visible, so undispellable) -1 maximum hit point left by Field Surgery.
export default card({ id: 'field-surgery-scar', name: 'Field Surgery Scar', house: 'war', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit, keywords: [Undispellable(), Grant({ maxHp: -1 })] });
