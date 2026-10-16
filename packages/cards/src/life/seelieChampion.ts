import { card, Script, Target } from '../lang';

// RULING: counts alterations cast on this archer after Seelie Champion, by either player. Group spells, instant spells
// and helper spells that effects create (not "cast") do not count.
export default card({ id: 'seelie-champion', name: 'Seelie Champion', house: 'life', cost: { clarity: 1, world: 1 }, type: 'alteration',
  target: Target.archer,
  keywords: [
    Script('+1 M for each alteration cast on it after this one.', {
      stats: (_q, _id, sp) => ({ missile: sp.tokens.n ?? 0 }),
      on: {
        'spell:cast': (c, ev) => {
          if (ev.ref?.kind !== 'minion' || c.host.kind !== 'minion' || ev.ref.id !== c.host.id) return;
          if (ev.data.type === 'alteration' && ev.data.spellId !== c.spell.id) c.setToken('n', c.token('n') + 1);
        },
      },
    }),
  ] });
