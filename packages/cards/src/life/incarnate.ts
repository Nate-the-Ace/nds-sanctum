import { recruitSpec } from '@sanctum/engine';
import { isHostMinion } from '../helpers';
import { card, Script, Target } from '../lang';

export default card({ id: 'incarnate', name: 'Incarnate', house: 'life', cost: { clarity: 1 }, type: 'alteration',
  target: Target.recruit,
  keywords: [
    Script("When the recruit dies, a recruit of the same nation and class is created in its owner's Sanctum (lost if it cannot be created this turn).", {
      on: {
        'minion:dies': (c, ev) => {
          if (!isHostMinion(c, ev)) return;
          const m = c.minion(ev.ref!.kind === 'minion' ? ev.ref!.id : -1);
          if (!m || m.owner === 'neutral' || (m.cls !== 'swordsman' && m.cls !== 'archer')) return;
          const sanctum = Object.values(c.state.structures).find((s) => s.kind === 'sanctum' && s.owner === m.owner);
          if (sanctum) c.createRecruit(sanctum.id, recruitSpec(m.cls, m.nation ?? undefined));
        },
      },
    }),
  ] });
