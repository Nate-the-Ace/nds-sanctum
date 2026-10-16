import { card, Create, Hero, Target } from '../lang';

// RULING: the two heroes are created independently, so a town whose group has room for only one of them gets one.
export default card({ id: 'vlad-hrothgar', name: 'Vlad Hrothgar', house: 'war', cost: { strife: 4, clarity: 4 }, type: 'hero',
  target: Target.structure.friendly,
  keywords: [
    Hero(),
    Create({ name: 'Vlad Hrothgar', cls: 'swordsman', nation: 'human', level: 2 }, { with: ['veteran'] }),
    Create({ name: 'Oro', cls: 'swordsman', nation: 'cyclops', level: 2 }, { with: ['rite-of-growth'] }),
  ] });
