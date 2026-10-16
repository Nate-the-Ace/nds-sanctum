import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'cleansing-light', name: 'Cleansing Light', house: 'life', cost: { clarity: 4 },
  type: 'manifestation', target: 'group',
  onCast: (c, t) => {
    if (t.kind !== 'group') return;
    const members = new Set(c.minionsOf(t.id).map((m) => m.id));
    for (const sp of [...c.state.spells]) {
      if (!sp.visible) continue; // non-visible spells cannot be dispelled
      const h = sp.host;
      if ((h.kind === 'group' && h.id === t.id) || (h.kind === 'minion' && members.has(h.id))) c.dispel(sp.id);
    }
  },
});
