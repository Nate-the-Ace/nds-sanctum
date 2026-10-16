import { card, Give, Heal, OnCast, Target } from '../lang';

export default card({ id: 'field-surgery', name: 'Field Surgery', house: 'war', cost: { strife: 1, clarity: 1 }, type: 'manifestation',
  target: Target.recruitGroup.friendly, keywords: [OnCast(Give('field-surgery-scar', 'targetDamaged'), Heal('full', 'targetEach'))] });
