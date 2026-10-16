import { defineCard } from '@sanctum/engine';

// The original only plays triumphant music after a victory: no rules effect.
export default defineCard({
  id: 'war-drums', name: 'War Drums', house: 'war', cost: { strife: 1 },
  type: 'alteration', target: 'recruitGroup',
});
