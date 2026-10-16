import type { Engine } from './engine';
import { dispatch } from './events';
import { removeSpellsOn } from './spellstore';
import type { Ref } from './types';
import { removeGroup } from './units';

export type DeathCategory = 'kills' | 'dies' | 'removed';

/**
 * The Minion Death pipeline (rules: Pipelines/death).
 * E1 is-dying (cancellable), E2 death events, E3 burial. 'removed' skips E1 and E2.
 */
export function killMinion(e: Engine, id: number, blame: number | null, category: DeathCategory): 'dead' | 'cancelled' {
  const s = e.state;
  const m = s.minions[id];
  if (!m || m.status === 'dead') return 'dead';
  const ref: Ref = { kind: 'minion', id };
  if (category !== 'removed') {
    m.status = 'dying';
    const ev = dispatch(e, 'minion:dying', ref, { blame, category });
    if (ev.data.cancel) {
      m.status = 'alive';
      if (m.hp > 0) return 'cancelled';
    }
    m.status = 'dead';
    if (category === 'kills') dispatch(e, 'minion:killed', ref, { blame });
    dispatch(e, 'minion:dies', ref, { blame, category });
  } else {
    m.status = 'dead';
  }
  removeSpellsOn(s, ref);
  const g = s.groups[m.groupId];
  if (g) {
    g.minionIds = g.minionIds.filter((x) => x !== id);
    if (g.minionIds.length === 0) removeGroup(e, g.id);
  }
  s.graveyard.push(id);
  s.log.push({ type: 'death', minion: id, category, blame });
  return 'dead';
}
