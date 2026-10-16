import { card, Script, Target, Undispellable } from '../lang';

// RULING: "cannot gain armor" is not enforced; armor gained from later spells still applies.
// RULING: the stat changes cannot be dispelled, so the spell is non-visible (visible: false) and
// Cleansing Light skips it.
export default card({
  id: 'swashbuckler', name: 'Swashbuckler', house: 'war', cost: { strife: 1 }, type: 'alteration',
  target: Target.swordsman,
  keywords: [
    Undispellable(),
    Script('Gain L equal to A, then A becomes 0.', {
      onCast: (c, t) => {
        if (t.kind === 'minion') c.setToken('n', c.stats(t.id).armor);
      },
      stats: (_q, _id, spell) => {
        const n = spell.tokens.n ?? 0;
        return { level: n, armor: -n };
      },
    }),
  ],
});
