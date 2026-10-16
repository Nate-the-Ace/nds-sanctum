import { card, Create, Target } from '../lang';

// RULING: the printed H:5 is base 2 + the card's +2 + the group's +1; the +3 lives in Warlord Command.
export default card({ id: 'warlord', name: 'Warlord', house: 'war', cost: { strife: 4, clarity: 3 }, type: 'summoning',
  target: Target.structure.friendly,
  keywords: [Create({ name: 'Warlord', cls: 'swordsman', nation: 'human', level: 2 }, { with: ['warlord-command'] })] });
