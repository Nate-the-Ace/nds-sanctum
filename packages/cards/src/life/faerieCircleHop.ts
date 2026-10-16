import type { EventContext } from '@sanctum/engine';
import { card, Script, Target, Undispellable } from '../lang';

/** Brings the group back at the start of its return turn, or the first later turn its square is empty. */
function comeBack(c: EventContext): void {
  const gid = c.token('gid');
  const g = c.group(gid);
  if (!g || g.pos) {
    c.dispel(); // removed from the game, or already back by other means
    return;
  }
  if (c.state.turn < c.token('back')) return;
  if (c.appear(gid, { x: c.token('x'), y: c.token('y') })) c.dispel();
}

export default card({ id: 'faerie-circle-hop', name: 'Faerie Circle (away)', house: 'life', cost: {}, type: 'alteration', helper: true,
  target: Target.globe,
  keywords: [Undispellable(), Script('Brings a group back from a Faerie Circle.', { on: { 'turn:start': comeBack } })] });
