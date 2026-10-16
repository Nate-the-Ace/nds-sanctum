import { defineCard } from '@sanctum/engine';
import { isHostMinion } from '../helpers';

// RULING: the "ignores armor against Gargoyles" clause is omitted (no Gargoyles exist yet).
export default defineCard({
  id: 'thermites', name: 'Thermites', house: 'war', cost: { strife: 2 },
  type: 'alteration', target: 'recruit',
  on: {
    'attacker:hits': (c, ev) => {
      if (!isHostMinion(c, ev)) return;
      const victim = c.minion(ev.data.victimId);
      if (victim) c.createSpell('thermite-damage', { kind: 'minion', id: victim.id });
    },
  },
});
