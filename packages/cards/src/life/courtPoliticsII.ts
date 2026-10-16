import { AddMana, card, On, Stackable, Target, When } from '../lang';

// Helper spell cast on the globe when Court Politics expires.
export default card({ id: 'court-politics-ii', name: 'Court Politics II', house: 'life', cost: {}, type: 'alteration', helper: true,
  target: Target.globe, keywords: [Stackable(), On(When.manaPhase, AddMana('clarity', 2))] });
