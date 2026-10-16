import { step } from '@sanctum/engine';
import type { EventContext, Pos, TerrainId } from '@sanctum/engine';
import { ADJACENT } from '../helpers';
import { card, hostGroupId, Immobile, Monster, Script, Target } from '../lang';

const ATTRACTING: TerrainId[] = ['plains', 'forest', 'desert'];

function myPos(c: EventContext): Pos | null {
  const gid = hostGroupId(c);
  return gid === undefined ? null : c.group(gid)?.pos ?? null;
}

/** Before movement, enemy player groups next to an attracting square must step onto one of them. */
function attract(c: EventContext): void {
  const me = myPos(c);
  if (!me) return;
  const spots = ADJACENT.map((d) => ({ x: me.x + d.x, y: me.y + d.y }))
    .filter((p) => c.state.cells.includes(`${p.x},${p.y}`) && ATTRACTING.includes(c.terrainAt(p) as TerrainId));
  if (!spots.length) return;
  for (const g of Object.values(c.state.groups)) {
    if (!g.pos || g.kind !== 'recruit' || g.owner === c.spell.owner || g.control !== 'player') continue;
    const from = g.pos;
    const moves = c.legalDirections(g.id).filter((d) => {
      const p = step(from, d);
      return spots.some((s) => s.x === p.x && s.y === p.y);
    });
    if (moves.length) c.setMoveOrder(g.id, moves[Math.floor(c.random() * moves.length)]);
  }
}

function dieOutOfWater(c: EventContext): void {
  const me = myPos(c);
  if (me && c.terrainAt(me) !== 'water' && c.host.kind === 'minion') c.kill(c.host.id);
}

// RULING: "dies if not in water" is checked at the start of the turn and before combat. Undine walks water
// (otherwise the engine would drown her where she is summoned).
export default card({ id: 'undine', name: 'Undine', house: 'life', cost: { clarity: 2, world: 2 }, type: 'summoning', host: 'minion',
  target: Target.square.on('water'),
  keywords: [
    Immobile(),
    Monster({ name: 'Undine', cls: 'monster', hand: 2, hp: 15, level: 3, walks: ['water'] }),
    Script('Plains, forest and desert next to Undine attract enemy groups: a group next to one must move onto it. Undine dies if not in water.', {
      on: { 'movement:before': attract, 'turn:startAfter': dieOutOfWater, 'combat:before': dieOutOfWater },
    }),
  ] });
