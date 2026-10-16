import type { Pos, QueryContext, TerrainId } from '@sanctum/engine';
import { card, Lasts, Script, Target } from '../lang';

const terrainOf = (q: QueryContext, p: Pos): TerrainId | undefined => (q.structureAt(p) ? 'plains' : q.terrainAt(p));

// RULING: "Structures count as plains" applies to the square the group stands on and to the one it would enter.
export default card({ id: 'terrain-bind', name: 'Terrain Bind', house: 'life', cost: { clarity: 4, world: 2 }, type: 'conjuration',
  target: Target.group,
  keywords: [
    Lasts(3),
    Script('It cannot enter a terrain different from the one it stands on (structures count as plains).', {
      blocksEntry: (q, sp, gid, dest) => {
        if (sp.host.kind !== 'group' || sp.host.id !== gid) return false;
        const g = q.group(gid);
        return !!g?.pos && terrainOf(q, dest) !== terrainOf(q, g.pos);
      },
    }),
  ] });
