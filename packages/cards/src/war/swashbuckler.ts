import { defineCard } from '@sanctum/engine';
import { isCls } from '../helpers';

// RULING: "cannot gain armor" is not enforced; armor gained from later spells still applies.
export default defineCard({
  id: 'swashbuckler', name: 'Swashbuckler', house: 'war', cost: { strife: 1 },
  type: 'alteration', target: 'recruit',
  canCast: isCls('swordsman'),
  onCast: (c, t) => {
    if (t.kind === 'minion') c.setToken('n', c.stats(t.id).armor);
  },
  stats: (_q, _id, spell) => {
    const n = spell.tokens.n ?? 0;
    return { level: n, armor: -n };
  },
});
