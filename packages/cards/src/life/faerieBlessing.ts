import { card, Grant, Script, Target } from '../lang';

// Visible like the original's Faerie Blessing (rules: Elements_spells "Persistent effects: Faerie Blessing").
export default card({ id: 'faerie-blessing', name: 'Faerie Blessing', house: 'life', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit,
  keywords: [
    Grant({ level: 1 }),
    Script('Its group cannot enter a Faerie Circle.', {
      blocksEntry: (q, sp, gid, dest) =>
        sp.host.kind === 'minion' && q.minion(sp.host.id)?.groupId === gid &&
        q.state.spells.some((x) => x.cardId === 'faerie-circle' && x.host.kind === 'square' && x.host.pos.x === dest.x && x.host.pos.y === dest.y),
    }),
  ] });
