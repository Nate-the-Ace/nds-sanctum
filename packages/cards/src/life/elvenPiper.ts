import { card, Fanfare, Target } from '../lang';

export default card({ id: 'elven-piper', name: 'Elven Piper', house: 'life', cost: { clarity: 1 }, type: 'alteration',
  target: Target.recruitGroup, keywords: [Fanfare('bagpipe music at start of combat')] });
