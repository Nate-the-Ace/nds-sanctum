import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'healing-hands', name: 'Healing Hands', house: 'life', cost: { clarity: 2 },
  type: 'alteration', target: 'recruit',
  on: {
    'turn:start': (c) => {
      if (c.host.kind !== 'minion') return;
      const m = c.minion(c.host.id);
      if (!m) return;
      for (const x of c.minionsOf(m.groupId)) c.heal(x.id, 1);
    },
  },
});
