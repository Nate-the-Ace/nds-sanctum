import { card, Grant, Target } from '../lang';

export default card({ id: 'palisade', name: 'Palisade', house: 'war', cost: { strife: 2, clarity: 2 }, type: 'alteration',
  target: Target.square, keywords: [Grant({ armor: 1 }, { to: 'archers' })] });
