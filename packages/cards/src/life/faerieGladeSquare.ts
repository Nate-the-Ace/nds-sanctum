import { defineCard } from '@sanctum/engine';

// Helper spell: one per forest square of a Faerie Glade. Enemy recruits standing here get -1 level.
export default defineCard({
  id: 'faerie-glade-square', name: 'Faerie Glade', house: 'life', cost: {},
  type: 'alteration', target: 'square', helper: true,
  stats: (q, id, spell) => {
    const m = q.minion(id);
    return m && m.kind === 'recruit' && m.owner !== spell.owner ? { level: -1 } : {};
  },
});
