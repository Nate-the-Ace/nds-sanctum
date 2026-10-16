import { card, Grant, Target } from '../lang';

export default card({ id: 'flaming-sword', name: 'Flaming Sword', house: 'war', cost: { strife: 2 }, type: 'alteration',
  target: Target.swordsman, keywords: [Grant({ hand: 2 })] });
