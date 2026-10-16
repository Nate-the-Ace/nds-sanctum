import { defineCard } from '@sanctum/engine';

// Helper spell: +4 maximum hit points for a recruit created under Auberol's Grace.
export default defineCard({
  id: 'grace-of-auberol', name: 'Grace of Auberol', house: 'life', cost: {},
  type: 'alteration', target: 'recruit', helper: true,
  stats: () => ({ maxHp: 4 }),
});
