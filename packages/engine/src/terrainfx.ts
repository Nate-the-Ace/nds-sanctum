import { key } from './board';
import { applyDamage } from './damage';
import { killMinion } from './death';
import type { Engine } from './engine';
import { minionsOf } from './query';
import { computeStats } from './stats';
import { TERRAIN_DAMAGE, terrainBlocks } from './terrain';
import type { Group, TerrainId } from './types';

export type TerrainWhen = 'afterStart' | 'beforeMovement' | 'beforeCombat';

/** Water drowns and void removes minions without the walk. Also used when such terrain is created under a group. */
export function checkFatal(e: Engine, g: Group): void {
  if (!g.pos) return;
  const t = e.state.terrain[key(g.pos)];
  if (t !== 'water' && t !== 'void') return;
  for (const m of minionsOf(e.state, g.id)) {
    const walks = computeStats(e, m.id).walks;
    if (walks.includes('flight')) continue;
    if (t === 'water') {
      if (!walks.includes('water')) killMinion(e, m.id, null, 'dies');
    } else {
      killMinion(e, m.id, null, 'removed');
    }
  }
}

/** Built-in terrain effects. Fatal terrain is checked at all three times, damage only after start of turn. */
export function applyTerrain(e: Engine, when: TerrainWhen): void {
  const s = e.state;
  for (const g of Object.values(s.groups)) {
    if (!s.groups[g.id] || !g.pos) continue;
    checkFatal(e, g);
    if (when !== 'afterStart' || !s.groups[g.id]) continue;
    const dmg = TERRAIN_DAMAGE[s.terrain[key(g.pos)]];
    if (!dmg) continue;
    for (const m of minionsOf(s, g.id)) {
      const walks = computeStats(e, m.id).walks;
      if (walks.includes('flight') || walks.includes(dmg.immune)) continue;
      applyDamage(e, m.id, dmg.damage);
    }
  }
}

/** Movement is unanimous: every minion must be able to enter (or exit) the terrain. */
export function groupCanEnter(e: Engine, g: Group, t: TerrainId): boolean {
  return minionsOf(e.state, g.id).every((m) => !terrainBlocks(t, computeStats(e, m.id).walks));
}
