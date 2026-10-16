import { card, Script, Target } from '../lang';
import { isHostMinion } from '../helpers';

// RULING: the kill is an instant-death ("dies") effect, so the attacker earns no experience for it.
export default card({
  id: 'shattering-blow', name: 'Shattering Blow', house: 'war', cost: { strife: 2, clarity: 1 }, type: 'alteration',
  target: Target.swordsman,
  keywords: [
    Script('On hit: Kill the victim, then -1 H.', {
      stats: (_q, _id, spell) => ({ hand: spell.tokens.shattered ? -1 : 0 }),
      on: {
        'attacker:hits': (c, ev) => {
          if (!isHostMinion(c, ev) || c.token('shattered')) return;
          c.setToken('shattered', 1);
          c.kill(ev.data.victimId);
        },
      },
    }),
  ],
});
