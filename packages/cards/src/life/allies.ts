import { card, Novices, OnCast, Target } from '../lang';

export default card({ id: 'allies', name: 'Allies', house: 'life', cost: { clarity: 4, world: 3 }, type: 'manifestation',
  target: Target.structure.friendly, keywords: [OnCast(Novices(2, 'elf'))] });
