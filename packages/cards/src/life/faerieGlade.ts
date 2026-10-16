import { defineCard } from '@sanctum/engine';
import { contiguous } from '../helpers';

// RULING: the engine only lets square spells target empty squares, so the target forest square must be unoccupied.
export default defineCard({
  id: 'faerie-glade', name: 'Faerie Glade', house: 'life', cost: { clarity: 3, world: 3 },
  type: 'manifestation', target: 'square',
  canCast: (q, t) => t.kind === 'square' && q.terrainAt(t.pos) === 'forest',
  onCast: (c, t) => {
    if (t.kind !== 'square') return;
    for (const p of contiguous(c, t.pos, 'forest')) {
      const has = c.state.spells.some((sp) => sp.cardId === 'faerie-glade-square' && sp.host.kind === 'square' && sp.host.pos.x === p.x && sp.host.pos.y === p.y);
      if (!has) c.createSpell('faerie-glade-square', { kind: 'square', pos: p });
    }
  },
});
