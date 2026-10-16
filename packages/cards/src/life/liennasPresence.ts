import { card, Script, Target } from '../lang';

// RULING: when Lienna leaves play the initiative is simply recomputed at the next start of turn, as the card says.
export default card({ id: 'liennas-presence', name: "Lienna's Presence", house: 'life', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit,
  keywords: [
    Script("While Lienna is in play, her caster's side has Initiative.", {
      on: { 'initiative:decide': (c) => { if (c.spell.owner !== 'neutral') c.setInitiative(c.spell.owner); } },
    }),
  ] });
