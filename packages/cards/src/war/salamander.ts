import { card, Monster, OnCast, Target, Terraform, Territorial } from '../lang';

export default card({ id: 'salamander', name: 'Salamander', house: 'war', cost: { strife: 3, clarity: 2 }, type: 'summoning', host: 'minion',
  target: Target.square,
  keywords: [Territorial(), Monster({ name: 'Salamander', cls: 'monster', hand: 4, hp: 12, level: 1, walks: ['fire'] }), OnCast(Terraform('lava'))] });
