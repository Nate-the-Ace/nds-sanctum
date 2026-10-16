import { card, Shroud, Target } from '../lang';

export default card({ id: 'seelie-favor', name: 'Seelie Favor', house: 'life', cost: { clarity: 2, world: 2 }, type: 'alteration',
  target: Target.group.nonFriendly, keywords: [Shroud({ from: ['group'] })] });
