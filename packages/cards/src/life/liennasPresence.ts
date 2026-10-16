import { card, Script, Target, Undispellable } from '../lang';

// RULING: non-dispellable identity helper (see decoyRuse.ts).

// RULING: Lienna vs Lienna (one on each side): both handlers run on 'initiative:decide' in spell order and the
// last one in that sequence wins, so the side whose Lienna was created later has Initiative.
// RULING: when Lienna leaves play the initiative is simply recomputed at the next start of turn, as the card says.
export default card({ id: 'liennas-presence', name: "Lienna's Presence", house: 'life', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit,
  keywords: [
    Undispellable(),
    Script("While Lienna is in play, her caster's side has Initiative.", {
      on: { 'initiative:decide': (c) => { if (c.spell.owner !== 'neutral') c.setInitiative(c.spell.owner); } },
    }),
  ] });
