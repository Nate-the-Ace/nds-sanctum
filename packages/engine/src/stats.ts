import { makeQuery } from './ctx';
import type { Engine } from './engine';
import { spellsOn, structureAt } from './query';
import { RULES } from './rules';
import type { Ref, Walk } from './types';

export interface StatDelta {
  hand?: number;
  missile?: number;
  armor?: number;
  maxHp?: number;
  level?: number;
  handAttacks?: number;
  missileAttacks?: number;
  walks?: Walk[];
  noDamage?: boolean;
  concealed?: boolean;
  taunt?: boolean;
}

export interface Stats {
  hand: number;
  missile: number;
  armor: number;
  maxHp: number;
  level: number;
  handAttacks: number;
  missileAttacks: number;
  walks: Walk[];
  noDamage: boolean;
  concealed: boolean;
  taunt: boolean;
}

/** Base stats plus the `stats` contribution of every active spell that reaches this minion. Never stored. */
export function computeStats(e: Engine, minionId: number): Stats {
  const s = e.state;
  const m = s.minions[minionId];
  if (!m) throw new Error(`no minion ${minionId}`);
  const b = m.base;
  const out: Stats = {
    hand: b.hand, missile: b.missile, armor: b.armor, maxHp: b.hp, level: b.level,
    handAttacks: b.handAttacks, missileAttacks: b.missileAttacks, walks: [...b.walks], noDamage: false, concealed: false, taunt: false,
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
  const add = (d: StatDelta | undefined | null): void => {
    if (!d) return;
    out.hand += d.hand ?? 0;
    out.missile += d.missile ?? 0;
    out.armor += d.armor ?? 0;
    out.maxHp += d.maxHp ?? 0;
    out.level += d.level ?? 0;
    out.handAttacks += d.handAttacks ?? 0;
    out.missileAttacks += d.missileAttacks ?? 0;
    if (d.walks) out.walks.push(...d.walks);
    if (d.noDamage) out.noDamage = true;
    if (d.concealed) out.concealed = true;
    if (d.taunt) out.taunt = true;
  };
  for (const ref of refs) {
    for (const sp of spellsOn(s, ref)) add(e.cards[sp.cardId]?.stats?.(q, minionId, sp));
  }
  if (g) {
    for (const mid of g.minionIds) {
      if (mid === m.id) continue;
      for (const sp of spellsOn(s, { kind: 'minion', id: mid })) {
        const card = e.cards[sp.cardId];
        if (card?.groupAura) add(card.stats?.(q, minionId, sp));
      }
    }
  }
  out.level = Math.max(0, Math.min(RULES.maxLevel, out.level));
  out.hand = Math.max(0, out.hand);
  out.missile = Math.max(0, out.missile);
  out.armor = Math.max(0, out.armor);
  out.handAttacks = Math.max(0, out.handAttacks);
  out.missileAttacks = Math.max(0, out.missileAttacks);
  out.maxHp = Math.max(1, out.maxHp);
  return out;
}

/** Recompute every live minion's maximum hit points and clamp current hit points to it. */
export function syncHp(e: Engine): void {
  for (const m of Object.values(e.state.minions)) {
    if (m.status === 'dead') continue;
    const max = computeStats(e, m.id).maxHp;
    m.maxHp = max;
    if (m.hp > max) m.hp = max;
  }
}
