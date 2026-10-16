import { card, hostGroupId, Monster, Nomadic, Script, Target } from '../lang';

// RULING: "fought only non-Justice minions" needs at least one combat: a Hellion that did not fight stays put.
export default card({ id: 'hellion', name: 'Hellion', house: 'war', cost: { strife: 5, clarity: 2 }, type: 'summoning', host: 'minion',
  target: Target.square,
  keywords: [
    Nomadic(),
    Monster({ name: 'Hellion', cls: 'monster', hand: 4, armor: 1, hp: 16, level: 3 }),
    Script('After all combat, if she fought only non-Justice minions this turn, she changes sides.', {
      on: {
        'combat:start': (c, ev) => {
          const gid = hostGroupId(c);
          if (gid === undefined || ev.ref?.kind !== 'group' || ev.ref.id !== gid) return;
          c.setToken('fought', 1);
          if (c.minionsOf(ev.data.opponent).some((m) => m.house === 'justice')) c.setToken('justice', 1);
        },
        'turn:afterCombat': (c) => {
          const gid = hostGroupId(c);
          if (gid === undefined) return;
          const flip = c.token('fought') === 1 && c.token('justice') === 0;
          c.setToken('fought', 0);
          c.setToken('justice', 0);
          if (flip) c.changeSides(gid);
        },
      },
    }),
  ] });
