import { card, Concealed, Target } from '../lang';

// Helper spell: conceals a recruit created under Clandestine.
export default card({ id: 'greymantle', name: 'Greymantle', house: 'life', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit, keywords: [Concealed()] });
