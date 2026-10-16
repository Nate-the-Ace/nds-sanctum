import { defineCard } from '@sanctum/engine';

// The original only plays bagpipe music at the start of combat: no rules effect.
export default defineCard({
  id: 'elven-piper', name: 'Elven Piper', house: 'life', cost: { clarity: 1 },
  type: 'alteration', target: 'recruitGroup',
});
