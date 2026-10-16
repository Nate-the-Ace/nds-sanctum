import { card, Fanfare, Target } from '../lang';

// The original only plays triumphant music after a victory: no rules effect.
export default card({ id: 'war-drums', name: 'War Drums', house: 'war', cost: { strife: 1 }, type: 'alteration',
  target: Target.recruitGroup, keywords: [Fanfare('triumphant music after a win')] });
