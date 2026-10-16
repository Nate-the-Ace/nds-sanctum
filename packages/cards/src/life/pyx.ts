import { card, Heal, OnCast, Target } from '../lang';

export default card({ id: 'pyx', name: 'Pyx', house: 'life', cost: { clarity: 1, world: 1 }, type: 'manifestation',
  target: Target.group, keywords: [OnCast(Heal('full', 'targetEach'))] });
