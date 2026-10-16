import { card, Grant, Target } from '../lang';

export default card({ id: 'drop-of-elixir-vitae', name: 'Drop of Elixir Vitae', house: 'life', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit, keywords: [Grant({ maxHp: 6 })] });
