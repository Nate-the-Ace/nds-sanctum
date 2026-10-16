import { card, Fanfare, Target } from '../lang';

export default card({ id: 'war-drums', name: 'War Drums', house: 'war', cost: { strife: 1 }, type: 'alteration',
  target: Target.recruitGroup, keywords: [Fanfare('triumphant music after a win')] });
