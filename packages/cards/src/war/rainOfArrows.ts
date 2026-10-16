import { card, Fleeting, Grant, Target } from '../lang';

export default card({ id: 'rain-of-arrows', name: 'Rain of Arrows', house: 'war', cost: { strife: 2, clarity: 1 }, type: 'alteration',
  target: Target.recruitGroup.with('archers'), keywords: [Fleeting(), Grant({ attacks: 1 }, { to: 'archers' })] });
