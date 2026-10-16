import { card, DispelAll, OnCast, Target } from '../lang';

export default card({ id: 'cleansing-light', name: 'Cleansing Light', house: 'life', cost: { clarity: 4 }, type: 'manifestation',
  target: Target.group, keywords: [OnCast(DispelAll())] });
