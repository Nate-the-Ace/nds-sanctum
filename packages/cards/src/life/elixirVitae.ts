import { card, Give, OnCast, Target } from '../lang';

export default card({ id: 'elixir-vitae', name: 'Elixir Vitae', house: 'life', cost: { clarity: 2, world: 2 }, type: 'manifestation',
  target: Target.globe, keywords: [OnCast(Give('drop-of-elixir-vitae', 'allRecruits'))] });
