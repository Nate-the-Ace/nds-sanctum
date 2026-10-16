import { defineCard } from '@sanctum/engine';
import { isHostGroup } from '../helpers';

export default defineCard({
  id: 'liennas-sigil', name: "Lienna's Sigil", house: 'life', cost: { clarity: 3 },
  type: 'alteration', target: 'group',
  on: {
    'combat:start': (c, ev) => {
      if (isHostGroup(c, ev) && c.group(ev.data.opponent)?.kind === 'monster') c.endCombat();
    },
  },
});
