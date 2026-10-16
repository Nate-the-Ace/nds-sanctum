import { defineCard } from '@sanctum/engine';
import { hasEnchantments, isHostMinion } from '../helpers';

// RULING: "enchantment" = a visible active spell on the attacker or on its group.
export default defineCard({
  id: 'filigreed-armor', name: 'Filigreed Armor', house: 'life', cost: { clarity: 2, world: 1 },
  type: 'alteration', target: 'recruit',
  stats: () => ({ armor: 1 }),
  on: {
    'attack:beforeArmor': (c, ev) => {
      if (!isHostMinion(c, ev)) return;
      const attacker = ev.data.attackerId == null ? undefined : c.minion(ev.data.attackerId);
      if (attacker && attacker.kind === 'recruit' && !hasEnchantments(c, attacker)) ev.data.damage -= 1;
    },
  },
});
