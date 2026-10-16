import { defineCard } from '@sanctum/engine';

// Helper spell: created on a victim by Thermites. Cumulative (createSpell ignores exclusivity).
export default defineCard({
  id: 'thermite-damage', name: 'Thermite Damage', house: 'war', cost: {},
  type: 'alteration', target: 'recruit', helper: true,
  stats: () => ({ armor: -1 }),
});
