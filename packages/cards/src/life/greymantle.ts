import { card, Concealed, Target } from '../lang';

export default card({ id: 'greymantle', name: 'Greymantle', house: 'life', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit, keywords: [Concealed()] });
