import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'berserkers', name: 'Berserkers', house: 'war', cost: { strife: 3 },
  type: 'alteration', target: 'recruitGroup',
  stats: (_q, _id, spell) => ({ hand: spell.tokens.casualties ?? 0 }),
  on: {
    'minion:dies': (c, ev) => {
      if (ev.data.blame != null) c.setToken('casualties', Math.min(3, c.token('casualties') + 1));
    },
    'combat:end': (c) => {
      c.setToken('casualties', 0);
    },
  },
});
