import { card, OnCast, Target, Terraform } from '../lang';

export default card({ id: 'plains', name: 'Plains', house: 'war', cost: { strife: 3 }, type: 'manifestation',
  target: Target.square, keywords: [OnCast(Terraform('plains'))] });
