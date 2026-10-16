import { card, Ramp, Target } from '../lang';

// Any death during combat counts, including instant kills (ctx.kill, blame null).
export default card({
  id: 'berserkers', name: 'Berserkers', house: 'war', cost: { strife: 3 }, type: 'alteration',
  target: Target.recruitGroup, keywords: [Ramp('casualty', 3)],
});
