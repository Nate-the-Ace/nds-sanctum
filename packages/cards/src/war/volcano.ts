import { card, OnCast, Target, Terraform } from '../lang';

export default card({ id: 'volcano', name: 'Volcano', house: 'war', cost: { strife: 4, clarity: 3 }, type: 'manifestation',
  target: Target.square, keywords: [OnCast(Terraform('volcano'))] });
