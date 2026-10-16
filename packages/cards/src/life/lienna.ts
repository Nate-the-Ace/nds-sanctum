import { card, Create, Hero, Target } from '../lang';

export default card({ id: 'lienna', name: 'Lienna', house: 'life', cost: { clarity: 4, world: 4 }, type: 'hero',
  target: Target.recruitGroup.in('forest'),
  keywords: [Hero(), Create({ name: 'Lienna', cls: 'archer', nation: 'elf', level: 2 }, { with: ['liennas-presence'] })] });
