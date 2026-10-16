import { card, Grant, Target } from '../lang';

/** Body house helper (Vlad Hrothgar's Oro starts with it). */
export default card({ id: 'rite-of-growth', name: 'Rite of Growth', house: 'body', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit, keywords: [Grant({ hand: 1, maxHp: 4 })] });
