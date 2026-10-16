import { card, Grant, Target } from '../lang';

export default card({ id: 'veteran', name: 'Veteran', house: 'war', cost: { strife: 3 }, type: 'alteration',
  target: Target.recruit, keywords: [Grant({ hand: 1, armor: 1, maxHp: 4 }, { heal: true })] });
