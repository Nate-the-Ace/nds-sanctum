import { card, Grant, Target } from '../lang';

// Helper spell: +4 maximum hit points for a recruit created under Auberol's Grace.
export default card({ id: 'grace-of-auberol', name: 'Grace of Auberol', house: 'life', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit, keywords: [Grant({ maxHp: 4 })] });
