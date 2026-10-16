import { isHostMinion } from '../helpers';
import { card, Grant, Script, Target } from '../lang';

// RULING: "magical damage ignores armor, immunities, and spells": the engine's magical damage ignores armor and skips
// before-armor effects; after-armor effects (Warded) still apply. Round 1's -1 missile penalty still applies.
export default card({ id: 'yeoman', name: 'Yeoman', house: 'life', cost: { clarity: 2, world: 1 }, type: 'alteration',
  target: Target.archer,
  keywords: [
    Grant({ missile: 1 }),
    Script('Its missile damage is magical (ignores armor). When it hits a Keeper, the Keeper dies and Yeoman is dispelled.', {
      on: {
        'attacker:strikes': (c, ev) => {
          if (isHostMinion(c, ev) && ev.data.kind === 'missile') ev.data.magical = true;
        },
        'attacker:hits': (c, ev) => {
          if (!isHostMinion(c, ev)) return;
          const v = c.minion(ev.data.victimId);
          if (v?.nation !== 'keeper') return;
          c.kill(v.id);
          c.dispel();
        },
      },
    }),
  ] });
