import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'pacifism', name: 'Pacifism', house: 'life', cost: { clarity: 2, world: 1 },
  type: 'alteration', target: 'recruit',
  stats: () => ({ handAttacks: -9, missileAttacks: -9, noDamage: true }),
});
