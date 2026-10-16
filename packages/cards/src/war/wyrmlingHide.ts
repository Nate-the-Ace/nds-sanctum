import { card, Grant, Target } from '../lang';

export default card({ id: 'wyrmling-hide', name: 'Wyrmling Hide', house: 'war', cost: {}, type: 'alteration', helper: true,
  target: Target.group, keywords: [Grant({ armor: 2 })] });
