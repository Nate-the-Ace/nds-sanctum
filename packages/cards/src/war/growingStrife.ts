import { Grant, recursive, Target } from '../lang';

/** Growing Strife and its hand copies (2..8 tokens). */
export const growingStrifeCards = recursive(
  { id: 'growing-strife', name: 'Growing Strife', house: 'war', cost: { strife: 2 }, type: 'alteration', target: Target.swordsman },
  (t) => [Grant({ hand: t })],
);
export default growingStrifeCards[0];
