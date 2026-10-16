import { card, Grant, Target } from '../lang';

// Helper spell: +6 maximum hit points from Elixir Vitae (an enchantment, so it can be dispelled).
export default card({ id: 'drop-of-elixir-vitae', name: 'Drop of Elixir Vitae', house: 'life', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit, keywords: [Grant({ maxHp: 6 })] });
