import { defineCard } from '@sanctum/engine';
import { ADJACENT } from '../helpers';

export default defineCard({
  id: 'oasis', name: 'Oasis', house: 'life', cost: { clarity: 3, world: 1 },
  type: 'alteration', target: 'structure',
  onCast: (c, t) => {
    if (t.kind !== 'structure') return;
    const s = c.structure(t.id);
    if (!s) return;
    for (const d of ADJACENT) c.setTerrain({ x: s.pos.x + d.x, y: s.pos.y + d.y }, 'desert');
  },
  on: {
    'turn:start': (c) => {
      if (c.host.kind !== 'structure') return;
      const s = c.structure(c.host.id);
      const g = s ? c.groupAt(s.pos) : undefined;
      if (g && g.kind === 'recruit') for (const m of c.minionsOf(g.id)) c.heal(m.id, 1);
    },
  },
});
