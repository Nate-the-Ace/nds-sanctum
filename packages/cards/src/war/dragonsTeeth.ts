import { card, Create, Target } from '../lang';

export default card({ id: 'dragons-teeth', name: "Dragon's Teeth", house: 'war', cost: { strife: 3, clarity: 3 }, type: 'summoning',
  target: Target.structure.friendly,
  keywords: [Create({ name: 'swordsman', cls: 'swordsman', level: 1 }, { count: 2, randomNation: true })] });
