import { defineCard } from '@sanctum/engine';
import { hasEnchantments, isHostMinion } from '../helpers';

// RULING: "enchantment" = a visible active spell on the attacker or on its group.
export default defineCard({
  id: 'faerie-knight', name: 'Faerie Knight', house: 'life', cost: { clarity: 4, world: 1 },
  type: 'alteration', target: 'recruit',
  stats: () => ({ maxHp: 4 }),
  onCast: (c, t) => {
    if (t.kind === 'minion') c.heal(t.id, 4);
  },
  on: {
    'armor:after': (c, ev) => {
      if (!isHostMinion(c, ev)) return;
      const attacker = ev.data.attackerId == null ? undefined : c.minion(ev.data.attackerId);
      if (attacker && attacker.kind === 'recruit' && !hasEnchantments(c, attacker)) c.cancel();
    },
  },
});
