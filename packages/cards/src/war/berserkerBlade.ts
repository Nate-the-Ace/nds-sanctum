import { defineCard } from '@sanctum/engine';
import { isCls, isHostMinion } from '../helpers';

export default defineCard({
  id: 'berserker-blade', name: 'Berserker Blade', house: 'war', cost: { strife: 2, clarity: 2 },
  type: 'alteration', target: 'recruit',
  canCast: isCls('swordsman'),
  stats: (_q, _id, spell) => ({ hand: spell.tokens.rage ?? 0 }),
  on: {
    'attack:hit': (c, ev) => {
      if (isHostMinion(c, ev)) c.setToken('rage', c.token('rage') + 1);
    },
    'combat:end': (c) => {
      c.setToken('rage', 0);
    },
  },
});
