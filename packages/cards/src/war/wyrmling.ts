import { card, Monster, Nomadic, Script, Target } from '../lang';

export default card({ id: 'wyrmling', name: 'Wyrmling', house: 'war', cost: { strife: 3, clarity: 2 }, type: 'summoning', host: 'minion',
  target: Target.square.on('volcano'),
  keywords: [
    Nomadic(),
    Monster({ name: 'Wyrmling', cls: 'monster', hand: 2, armor: 2, hp: 6, level: 0, walks: ['flight'] }, { neutral: true }),
    Script('If killed by a recruit group, that group gets Wyrmling Hide (all members +2 A).', {
      on: {
        'minion:killed': (c, ev) => {
          if (ev.ref?.kind !== 'minion' || c.host.kind !== 'minion' || ev.ref.id !== c.host.id) return;
          const killer = ev.data.blame == null ? undefined : c.minion(ev.data.blame);
          if (killer?.kind !== 'recruit') return;
          // Wyrmling Hide does not stack: a group that already wears one gains nothing from a second kill.
          if (c.state.spells.some((s) => s.cardId === 'wyrmling-hide' && s.host.kind === 'group' && s.host.id === killer.groupId)) return;
          c.createSpell('wyrmling-hide', { kind: 'group', id: killer.groupId }, { owner: killer.owner });
        },
      },
    }),
  ] });
