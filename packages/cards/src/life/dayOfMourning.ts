import { card, Lasts, Script, Target } from '../lang';

// RULING: "dies" covers kills and instant deaths, not minions removed from the game. The card is removed, not discarded.
export default card({ id: 'day-of-mourning', name: 'Day of Mourning', house: 'life', cost: { clarity: 4, world: 1 }, type: 'conjuration',
  target: Target.globe,
  keywords: [
    Lasts(5),
    Script("Each time a recruit dies, the top card of its owner's deck is removed from the game.", {
      on: {
        'minion:dies': (c, ev) => {
          if (ev.ref?.kind !== 'minion') return;
          const m = c.minion(ev.ref.id);
          if (m?.kind === 'recruit' && m.owner !== 'neutral') c.removeTopCard(m.owner);
        },
      },
    }),
  ] });
