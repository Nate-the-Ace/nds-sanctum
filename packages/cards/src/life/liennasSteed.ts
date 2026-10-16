import { defineCard } from '@sanctum/engine';
import { isFriendlyGroup } from '../helpers';

// RULING: "diagonally toward the opponent's edge" is +1,+1 for red and -1,-1 for blue on our grid.
export default defineCard({
  id: 'liennas-steed', name: "Lienna's Steed", house: 'life', cost: { clarity: 2, world: 2 },
  type: 'manifestation', target: 'recruitGroup',
  canCast: isFriendlyGroup,
  onCast: (c, t) => {
    if (t.kind !== 'group') return;
    const g = c.group(t.id);
    if (!g?.pos) return;
    const d = c.spell.owner === 'red' ? 1 : -1;
    const dest = { x: g.pos.x + d, y: g.pos.y + d };
    if (c.canEnter(t.id, dest) && !c.groupAt(dest)) c.moveGroup(t.id, dest);
    c.setMoveOrder(t.id, null);
  },
});
