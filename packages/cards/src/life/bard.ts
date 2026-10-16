import { card, Create, Target } from '../lang';

export default card({ id: 'bard', name: 'Bard', house: 'life', cost: { clarity: 4, world: 2 }, type: 'summoning',
  target: Target.recruitGroup,
  keywords: [Create({ name: 'Bard', cls: 'swordsman', nation: 'elf', hand: 0, armor: 3 }, { with: ['bard-song'] })] });
