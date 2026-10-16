import { defineCard } from '@sanctum/engine';

// "Turn of casting +1" = the casting turn and the next. RULING: computer-controlled recruit groups choose their own
// orders after "before movement" effects (rules: Pipelines/movement), so Standoff cannot stop them.
// RULING: relocation effects (Lienna's Steed) still work during Standoff, because the engine has no "cannot be moved" stat.
export default defineCard({
  id: 'standoff', name: 'Standoff', house: 'life', cost: { clarity: 3, world: 2 },
  type: 'conjuration', target: 'globe', duration: { turns: 2 },
  on: {
    'movement:before': (c) => {
      for (const g of Object.values(c.state.groups)) {
        if (g.kind !== 'recruit') continue;
        c.setMoveOrder(g.id, null);
        c.setMovesTwice(g.id, false);
      }
    },
  },
});
