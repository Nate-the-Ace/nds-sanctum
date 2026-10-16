import { defineCard } from '@sanctum/engine';

// Helper spell: conceals a recruit created under Clandestine.
export default defineCard({
  id: 'greymantle', name: 'Greymantle', house: 'life', cost: {},
  type: 'alteration', target: 'recruit', helper: true,
  stats: () => ({ concealed: true }),
});
