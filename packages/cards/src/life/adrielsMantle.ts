import { defineCard } from '@sanctum/engine';
import { GROUP_TARGETS, INDIVIDUAL_TARGETS } from '../helpers';

export default defineCard({
  id: 'adriels-mantle', name: "Adriel's Mantle", house: 'life', cost: { clarity: 2, world: 1 },
  type: 'conjuration', target: 'group', duration: { turns: 2 },
  blocksCast: (q, sp, a) => {
    if (sp.host.kind !== 'group') return false;
    const hostId = sp.host.id;
    if (GROUP_TARGETS.includes(a.card.target)) return a.target.kind === 'group' && a.target.id === hostId;
    if (INDIVIDUAL_TARGETS.includes(a.card.target)) {
      return a.target.kind === 'minion' && q.minion(a.target.id)?.groupId === hostId;
    }
    return false;
  },
});
