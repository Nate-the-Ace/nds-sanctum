import { ADJACENT } from '../helpers';
import { card, Lasts, Script, Target } from '../lang';

// RULING: "On turn of casting only, all minions in the four adjacent squares are fully healed" is one heal, when the
// spell is cast. "Turn of casting +1" = Lasts 2.
export default card({ id: 'fae-quadrille', name: 'Fae Quadrille', house: 'life', cost: { clarity: 3, world: 2 }, type: 'conjuration',
  target: Target.square,
  keywords: [
    Lasts(2),
    Script('Heal every minion in the four adjacent squares fully when cast. The square cannot be entered.', {
      onCast: (c, t) => {
        if (t.kind !== 'square') return;
        for (const d of ADJACENT) {
          const g = c.groupAt({ x: t.pos.x + d.x, y: t.pos.y + d.y });
          if (g) for (const m of c.minionsOf(g.id)) c.heal(m.id, 999);
        }
      },
      blocksEntry: (_q, sp, _gid, dest) => sp.host.kind === 'square' && sp.host.pos.x === dest.x && sp.host.pos.y === dest.y,
    }),
  ] });
