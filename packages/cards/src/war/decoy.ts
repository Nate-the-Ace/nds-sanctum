import { card, Create, Target } from '../lang';

export default card({ id: 'decoy', name: 'Decoy', house: 'war', cost: { strife: 4, clarity: 2 }, type: 'summoning',
  target: Target.recruitGroup.friendly,
  keywords: [Create({ name: 'Decoy', cls: 'swordsman', nation: 'human' }, { with: ['decoy-ruse'], onePerGroup: true })] });
