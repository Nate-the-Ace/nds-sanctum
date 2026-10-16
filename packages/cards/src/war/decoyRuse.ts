import { card, Grant, Pacified, Target, Taunt } from '../lang';

export default card({ id: 'decoy-ruse', name: 'Decoy Ruse', house: 'war', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit, keywords: [Grant({ armor: 2 }), Pacified(), Taunt()] });
