import { card, Grant, Target } from '../lang';

export default card({ id: 'legionnaires', name: 'Legionnaires', house: 'war', cost: { strife: 3, clarity: 1 }, type: 'alteration',
  target: Target.recruitGroup.with('swordsmen'), keywords: [Grant({ hand: 1 }, { to: 'swordsmen' })] });
