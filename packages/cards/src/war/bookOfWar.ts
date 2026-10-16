import { card, Script, Target } from '../lang';

const KILLER = 'k';

// RULING: one level per recruit per turn however many it kills ("regardless of the number of kills"); monsters never
// gain levels. The level is a permanent base level, capped at 5.
export default card({ id: 'book-of-war', name: 'Book of War', house: 'war', cost: { strife: 4, clarity: 4 }, type: 'alteration',
  target: Target.globe,
  keywords: [
    Script('When a recruit kills by combat damage, it gets +1 L at the start of the next turn (once per turn, at most L5).', {
      on: {
        'attacker:kills': (c, ev) => {
          if (ev.ref?.kind === 'minion' && c.minion(ev.ref.id)?.kind === 'recruit') c.setToken(`${KILLER}${ev.ref.id}`, 1);
        },
        'turn:start': (c) => {
          for (const [name, v] of Object.entries(c.spell.tokens)) {
            if (!name.startsWith(KILLER) || v !== 1) continue;
            c.addLevel(Number(name.slice(KILLER.length)), 1);
            c.setToken(name, 0);
          }
        },
      },
    }),
  ] });
