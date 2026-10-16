import { Grant, recursive, Target } from '../lang';

/** Greater Clarity and its hand copies (2..8 tokens). */
export const greaterClarityCards = recursive(
  { id: 'greater-clarity', name: 'Greater Clarity', house: 'life', cost: { clarity: 2 }, type: 'alteration', target: Target.archer },
  (t) => [Grant({ missile: t })],
);
export default greaterClarityCards[0];
