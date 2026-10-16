import { card, Grant, Target, Undispellable } from '../lang';

export default card({ id: 'field-surgery-scar', name: 'Field Surgery', house: 'war', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit, keywords: [Undispellable(), Grant({ maxHp: -1 })] });
