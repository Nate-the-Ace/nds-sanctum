import { card, Script, Target } from '../lang';

// RULING: what the spy learns is private (PlayerState.intel) and lasts until the next start of turn. A neutral
// structure has no deck, so it tells nothing.
export default card({ id: 'spy-at-court', name: 'Spy at Court', house: 'life', cost: { clarity: 1, world: 1 }, type: 'alteration',
  target: Target.structure,
  keywords: [
    Script("Start of turn: its caster sees the top card of the town's owner's deck.", {
      on: {
        'turn:start': (c) => {
          const st = c.host.kind === 'structure' ? c.structure(c.host.id) : undefined;
          const to = c.spell.owner;
          const from = st?.owner;
          if (!from || to === 'neutral' || from === 'neutral') return;
          c.reveal(to, from);
        },
      },
    }),
  ] });
