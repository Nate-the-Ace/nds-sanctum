import { card, Fanfare, Target } from '../lang';

// The original only plays bagpipe music at the start of combat: no rules effect.
export default card({ id: 'elven-piper', name: 'Elven Piper', house: 'life', cost: { clarity: 1 }, type: 'alteration',
  target: Target.recruitGroup, keywords: [Fanfare('bagpipe music at start of combat')] });
