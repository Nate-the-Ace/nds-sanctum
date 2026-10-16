import { defineCard } from '@sanctum/engine';
import { GROUP_TARGETS } from '../helpers';

export default defineCard({
  id: 'individualism', name: 'Individualism', house: 'life', cost: { clarity: 3, world: 2 },
  type: 'conjuration', target: 'globe', duration: { turns: 3 },
  blocksCast: (_q, _sp, a) => GROUP_TARGETS.includes(a.card.target),
});
