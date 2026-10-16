import { Bound, card, Grant, Target } from '../lang';

// Helper spell: one per forest square of a Faerie Glade. Enemy recruits standing here get -1 level.
export default card({ id: 'faerie-glade-square', name: 'Faerie Glade', house: 'life', cost: {}, type: 'alteration', helper: true,
  target: Target.square, keywords: [Bound('forest'), Grant({ level: -1 }, { to: 'enemies' })] });
