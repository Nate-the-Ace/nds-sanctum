import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'armistice', name: 'Armistice', house: 'war', cost: { strife: 4, clarity: 4 },
  type: 'conjuration', target: 'globe', duration: { turns: 3 },
  on: {
    'combat:before': (c) => c.cancel(),
  },
});
