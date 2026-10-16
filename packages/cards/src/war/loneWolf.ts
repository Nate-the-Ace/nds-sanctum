import { card, Grant, Shroud, Target } from '../lang';

// RULING: "cannot join groups or add new recruits" is not enforced (the engine has no join-prevention hook yet).
export default card({ id: 'lone-wolf', name: 'Lone Wolf', house: 'war', cost: { strife: 2, clarity: 1 }, type: 'alteration',
  target: Target.swordsman.alone, keywords: [Shroud({ against: 'friendly' }), Grant({ hand: 3, armor: 1, maxHp: 6 }, { heal: true })] });
