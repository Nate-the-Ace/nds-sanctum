import { card, Grant, Target } from '../lang';

export default card({ id: 'ngozis-way', name: "Ngozi's Way", house: 'war', cost: { strife: 5, clarity: 1 }, type: 'alteration',
  target: Target.recruitGroup, keywords: [Grant({ level: 1 })] });
