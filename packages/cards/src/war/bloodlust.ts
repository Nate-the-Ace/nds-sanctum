import { card, Grant, Target } from '../lang';

export default card({ id: 'bloodlust', name: 'Bloodlust', house: 'war', cost: { strife: 2, clarity: 1 }, type: 'alteration',
  target: Target.swordsman, keywords: [Grant({ attacks: 1 })] });
