import { card, Grant, Target } from '../lang';

export default card({ id: 'youth', name: 'Youth', house: 'life', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit, keywords: [Grant({ level: -1 })] });
