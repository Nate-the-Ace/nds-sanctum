import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'berserkers', name: 'Berserkers', house: 'war', cost: { strife: 3 },
  type: 'alteration', target: 'recruitGroup',
  stats: (_q, _id, spell) => ({ hand: spell.tokens.casualties ?? 0 }),
  on: {
    'combat:start': (c) => {
      c.setToken('fighting', 1);
    },
    // Any death during combat counts, including instant kills (ctx.kill, blame null).
    'minion:dies': (c) => {
      if (c.token('fighting') === 1) c.setToken('casualties', Math.min(3, c.token('casualties') + 1));
    },
    'combat:end': (c) => {
      c.setToken('casualties', 0);
      c.setToken('fighting', 0);
    },
  },
});
