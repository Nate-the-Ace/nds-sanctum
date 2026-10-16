import { card, nomadicBot, Script, Target } from '../lang';

// RULING: the original neutral-group AI is unknown; the renegades hunt the nearest hostile recruit group like a Nomadic
// monster. Spells on the group keep their owners. Neutral groups already move last, fight everyone, have
// half-initiative and (being computer-controlled) never enter structures.
export default card({ id: 'renegades', name: 'Renegades', house: 'war', cost: { strife: 6, clarity: 2 }, type: 'manifestation',
  target: Target.recruitGroup.playerControlled.atMost(3).notInStructure,
  keywords: [
    Script('It leaves player control and becomes neutral: it moves on its own and attacks every other group.', {
      onCast: (c, t) => {
        if (t.kind !== 'group') return;
        c.setControl(t.id, 'computer');
        c.setOwner(t.id, 'neutral');
      },
      bot: nomadicBot,
    }),
  ] });
