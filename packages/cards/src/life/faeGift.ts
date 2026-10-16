import { isHostMinion } from '../helpers';
import { card, Script, Target } from '../lang';

// RULING: the change into an Elf is permanent (it stays if Fae Gift is dispelled); the healing stops with the spell.
export default card({ id: 'fae-gift', name: 'Fae Gift', house: 'life', cost: { clarity: 3, world: 1 }, type: 'alteration',
  target: Target.swordsman,
  keywords: [
    Script('Becomes an Elf. Its attacks heal the victim instead of damaging it (armor soaks first).', {
      onCast: (c, t) => {
        if (t.kind === 'minion') c.setNation(t.id, 'elf');
      },
      on: {
        'attacker:strikes': (c, ev) => {
          if (isHostMinion(c, ev)) ev.data.heals = true;
        },
      },
    }),
  ] });
