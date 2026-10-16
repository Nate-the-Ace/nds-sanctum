import { defineCard } from '@sanctum/engine';
import { GROUP_TARGETS, INDIVIDUAL_TARGETS } from '../helpers';

export default defineCard({
  id: 'court-politics', name: 'Court Politics', house: 'life', cost: { clarity: 3, world: 3 },
  type: 'conjuration', target: 'globe', duration: { turns: 3 }, exclusive: false,
  blocksCast: (q, sp, a) => {
    if (a.caster !== sp.owner) return false;
    if (GROUP_TARGETS.includes(a.card.target)) return a.target.kind === 'group' && q.group(a.target.id)?.owner === sp.owner;
    if (INDIVIDUAL_TARGETS.includes(a.card.target)) return a.target.kind === 'minion' && q.minion(a.target.id)?.owner === sp.owner;
    return false;
  },
  onExpire: (c) => {
    c.createSpell('court-politics-ii', { kind: 'globe' });
  },
});
