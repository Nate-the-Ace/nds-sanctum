import type { EventContext, QueryContext } from '@sanctum/engine';
import { Bound, card, Script, Target } from '../lang';

const blessed = (q: QueryContext, id: number) =>
  q.state.spells.some((sp) => sp.cardId === 'faerie-blessing' && sp.host.kind === 'minion' && sp.host.id === id);

function take(c: EventContext): void {
  if (c.host.kind !== 'square') return;
  const pos = c.host.pos;
  const g = c.groupAt(pos);
  if (!g || c.minionsOf(g.id).some((m) => blessed(c, m.id))) return;
  const away = 1 + Math.floor(c.random() * 5);
  for (const m of c.minionsOf(g.id)) {
    c.heal(m.id, 999);
    c.createSpell('faerie-blessing', { kind: 'minion', id: m.id });
  }
  c.hide(g.id);
  c.createSpell('faerie-circle-hop', { kind: 'globe' }, {
    tokens: { gid: g.id, x: pos.x, y: pos.y, back: c.state.turn + away + 1, circle: c.spell.id },
  });
}

/** Rules (Concepts_boardhop): "If the boardhop spell is dispelled while a group is inside, that group is removed". */
function strand(c: EventContext): void {
  for (const sp of c.state.spells.filter((x) => x.cardId === 'faerie-circle-hop' && x.tokens.circle === c.spell.id)) {
    const g = c.group(sp.tokens.gid);
    if (g && !g.pos) c.removeGroup(g.id);
    c.dispel(sp.id);
  }
}

// RULING: any group on the square is taken (monsters too). Members are healed and blessed as they leave; a group with a
// blessed member is never taken again ("cannot re-enter"), and coming back onto the circle is not entering it.
// "Current turn +1-5": away for the current turn and 1-5 more, back at the start of the turn after.
export default card({ id: 'faerie-circle', name: 'Faerie Circle', house: 'life', cost: { clarity: 4, world: 2 }, type: 'alteration',
  target: Target.square.on('forest'),
  keywords: [
    Bound('forest'),
    Script('Start of turn: the group here disappears for this turn and the next 1-5 unless a member has Faerie Blessing. Its members are healed fully and get Faerie Blessing. It comes back at the start of the first turn its square is empty. If Faerie Circle ends while it is away, the group is removed from the game.', {
      on: { 'turn:start': take },
      onDispel: strand,
    }),
  ] });
