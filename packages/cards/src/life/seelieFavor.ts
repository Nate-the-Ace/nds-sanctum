import { defineCard } from '@sanctum/engine';
import { GROUP_TARGETS } from '../helpers';

export default defineCard({
  id: 'seelie-favor', name: 'Seelie Favor', house: 'life', cost: { clarity: 2, world: 2 },
  type: 'alteration', target: 'group',
  canCast: (q, t) => t.kind === 'group' && q.group(t.id)?.owner !== q.caster,
  blocksCast: (_q, sp, a) =>
    sp.host.kind === 'group' && GROUP_TARGETS.includes(a.card.target) && a.target.kind === 'group' && a.target.id === sp.host.id,
});
