import { defineCard } from '@sanctum/engine';

// Helper spell: +6 maximum hit points from Elixir Vitae (an enchantment, so it can be dispelled).
export default defineCard({
  id: 'drop-of-elixir-vitae', name: 'Drop of Elixir Vitae', house: 'life', cost: {},
  type: 'alteration', target: 'recruit', helper: true,
  stats: () => ({ maxHp: 6 }),
});
