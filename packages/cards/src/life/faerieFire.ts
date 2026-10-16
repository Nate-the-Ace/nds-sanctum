import { card, Fleeting, Grant, Target } from '../lang';

export default card({ id: 'faerie-fire', name: 'Faerie Fire', house: 'life', cost: { clarity: 3 }, type: 'alteration',
  target: Target.recruitGroup.with('archers'), keywords: [Fleeting(), Grant({ missile: 2 }, { to: 'archers' })] });
