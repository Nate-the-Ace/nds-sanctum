import { defineCard } from '@sanctum/engine';

// Helper spell: permanent (non-visible, so undispellable) -1 maximum hit point left by Field Surgery.
export default defineCard({
  id: 'field-surgery-scar', name: 'Field Surgery', house: 'war', cost: {},
  type: 'alteration', target: 'recruit', helper: true, visible: false,
  stats: () => ({ maxHp: -1 }),
});
