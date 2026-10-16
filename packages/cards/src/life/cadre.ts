import { card, Target, Versus } from '../lang';

export default card({ id: 'cadre', name: 'Cadre', house: 'life', cost: { clarity: 2, world: 1 }, type: 'alteration',
  target: Target.recruitGroup.with('archers'), keywords: [Versus({ missile: 1 }, { cls: 'swordsman' }, { to: 'archers' })] });
