import { makeQuery } from './ctx';
import type { Engine } from './engine';
import { spellsOn, structureAt } from './query';
import { RULES } from './rules';
import type { Ref, Walk } from './types';

export interface StatDelta {
  hand?: number;
  missile?: number;
  armor?: number;
  level?: number;
  handAttacks?: number;
  missileAttacks?: number;
  walks?: Walk[];
  noDamage?: boolean;
}

export interface Stats {
  hand: number;
  missile: number;
  armor: number;
  level: number;
  handAttacks: number;
  missileAttacks: number;
  walks: Walk[];
  noDamage: boolean;
}

/** Base stats plus the `stats` contribution of every active spell that reaches this minion. Never stored. */
export function computeStats(e: Engine, minionId: number): Stats {
  const s = e.state;
  const m = s.minions[minionId];
  if (!m) throw new Error(`no minion ${minionId}`);
  const b = m.base;
  const out: Stats = {
    hand: b.hand, missile: b.missile, armor: b.armor, level: b.level,
    handAttacks: b.handAttacks, missileAttacks: b.missileAttacks, walks: [...b.walks], noDamage: false,
  };
  const g = s.groups[m.groupId];
  const refs: Ref[] = [{ kind: 'minion', id: m.id }, { kind: 'group', id: m.groupId }];
  if (g?.pos) {
    refs.push({ kind: 'square', pos: g.pos });
    const st = structureAt(s, g.pos);
    if (st) refs.push({ kind: 'structure', id: st.id });
  }
  refs.push({ kind: 'globe' });
  const q = makeQuery(e, m.owner);
  for (const ref of refs) {
    for (const sp of spellsOn(s, ref)) {
      const d = e.cards[sp.cardId]?.stats?.(q, minionId, sp);
      if (!d) continue;
      out.hand += d.hand ?? 0;
      out.missile += d.missile ?? 0;
      out.armor += d.armor ?? 0;
      out.level += d.level ?? 0;
      out.handAttacks += d.handAttacks ?? 0;
      out.missileAttacks += d.missileAttacks ?? 0;
      if (d.walks) out.walks.push(...d.walks);
      if (d.noDamage) out.noDamage = true;
    }
  }
  out.level = Math.max(0, Math.min(RULES.maxLevel, out.level));
  out.hand = Math.max(0, out.hand);
  out.missile = Math.max(0, out.missile);
  out.armor = Math.max(0, out.armor);
  out.handAttacks = Math.max(0, out.handAttacks);
  out.missileAttacks = Math.max(0, out.missileAttacks);
  return out;
}
