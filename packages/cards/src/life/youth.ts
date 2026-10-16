import { defineCard } from '@sanctum/engine';

// Helper spell: created on each member of a group that enters a Fountain of Youth.
export default defineCard({
  id: 'youth', name: 'Youth', house: 'life', cost: {},
  type: 'alteration', target: 'recruit', helper: true,
  stats: () => ({ level: -1 }),
});
