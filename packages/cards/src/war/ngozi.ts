import { card, Create, Hero, Target } from '../lang';

export default card({ id: 'ngozi', name: 'Ngozi', house: 'war', cost: { strife: 4, clarity: 4 }, type: 'hero',
  target: Target.recruitGroup,
  keywords: [Hero(), Create({ name: 'Ngozi', cls: 'swordsman', nation: 'human', level: 2 }, { with: ['ngozis-blight'] })] });
