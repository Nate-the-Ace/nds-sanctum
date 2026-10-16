import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'elixir-vitae', name: 'Elixir Vitae', house: 'life', cost: { clarity: 2, world: 2 },
  type: 'manifestation', target: 'globe',
  onCast: (c) => {
    for (const m of Object.values(c.state.minions)) {
      if (m.kind === 'recruit' && m.status === 'alive' && c.group(m.groupId)?.pos) {
        c.createSpell('drop-of-elixir-vitae', { kind: 'minion', id: m.id });
      }
    }
  },
});
