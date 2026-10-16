import { card, Grant, Target } from '../lang';

export default card({ id: 'marksman', name: 'Marksman', house: 'war', cost: { strife: 3, clarity: 2 }, type: 'alteration',
  target: Target.archer, keywords: [Grant({ missile: 1, attacks: 1, maxHp: 2 }, { heal: true })] });
