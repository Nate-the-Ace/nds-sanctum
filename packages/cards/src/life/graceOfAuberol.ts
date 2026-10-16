import { card, Grant, Target } from '../lang';

export default card({ id: 'grace-of-auberol', name: 'Grace of Auberol', house: 'life', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit, keywords: [Grant({ maxHp: 4 })] });
