import type { EventContext } from '@sanctum/engine';
import { isHostMinion } from '../helpers';
import { card, Script, Target, Versus } from '../lang';

const BURN = 'burn:';

/** After all combat, every forest square this archer hit a victim in becomes barren. */
function burn(c: EventContext): void {
  for (const [name, v] of Object.entries(c.spell.tokens)) {
    if (!name.startsWith(BURN) || v !== 1) continue;
    const [x, y] = name.slice(BURN.length).split(',').map(Number);
    c.setTerrain({ x, y }, 'barren');
    c.setToken(name, 0);
  }
}

// RULING: "opponent in forest" is judged where the victim stands when it is hit; the square burns even if the victim
// later leaves it or dies.
export default card({ id: 'flaming-arrows', name: 'Flaming Arrows', house: 'war', cost: { strife: 2, clarity: 1 }, type: 'alteration',
  target: Target.archer,
  keywords: [
    Versus({ missile: 3 }, { in: ['structure', 'forest'] }),
    Script('When it hits an opponent in forest, that square becomes barren after all combat.', {
      on: {
        'attacker:hits': (c, ev) => {
          if (!isHostMinion(c, ev)) return;
          const v = c.minion(ev.data.victimId);
          const p = v ? c.group(v.groupId)?.pos : null;
          if (p && c.terrainAt(p) === 'forest') c.setToken(`${BURN}${p.x},${p.y}`, 1);
        },
        'turn:afterCombat': burn,
      },
    }),
  ] });
