import { card, Lasts, Target, Truce } from '../lang';

export default card({ id: 'armistice', name: 'Armistice', house: 'war', cost: { strife: 4, clarity: 4 }, type: 'conjuration',
  target: Target.globe, keywords: [Truce(), Lasts(3)] });
