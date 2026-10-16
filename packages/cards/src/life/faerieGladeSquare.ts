import { Bound, card, Grant, Target } from '../lang';

export default card({ id: 'faerie-glade-square', name: 'Faerie Glade', house: 'life', cost: {}, type: 'alteration', helper: true,
  target: Target.square, keywords: [Bound('forest'), Grant({ level: -1 }, { to: 'enemies' })] });
