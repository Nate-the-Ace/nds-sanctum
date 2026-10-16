import type { EventContext, GameEvent, Minion, Pos, QueryContext, Ref, TerrainId } from '@sanctum/engine';

export const ADJACENT: Pos[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

export const minionAt = (q: QueryContext, t: Ref): Minion | undefined => (t.kind === 'minion' ? q.minion(t.id) : undefined);

/** canCast: the target minion has this class. */
export const isCls =
  (cls: 'swordsman' | 'archer') =>
  (q: QueryContext, t: Ref): boolean =>
    minionAt(q, t)?.cls === cls;

/** canCast: the target minion is owned by the caster. */
export const isFriendlyMinion = (q: QueryContext, t: Ref): boolean => minionAt(q, t)?.owner === q.caster;

/** canCast: the target group contains at least one minion of this class. */
export const groupHas =
  (cls: 'swordsman' | 'archer') =>
  (q: QueryContext, t: Ref): boolean =>
    t.kind === 'group' && q.minionsOf(t.id).some((m) => m.cls === cls);

/** True when `ev` was dispatched on the minion this spell is hosted on. */
export const isHostMinion = (c: EventContext, ev: GameEvent): boolean =>
  ev.ref?.kind === 'minion' && c.host.kind === 'minion' && ev.ref.id === c.host.id;

/** True when `ev` was dispatched on the group this spell is hosted on. */
export const isHostGroup = (c: EventContext, ev: GameEvent): boolean =>
  ev.ref?.kind === 'group' && c.host.kind === 'group' && ev.ref.id === c.host.id;

/** Orthogonally contiguous squares of one terrain type, starting at (and including) `start`. */
export function contiguous(q: QueryContext, start: Pos, terrain: TerrainId): Pos[] {
  const seen = new Set<string>();
  const out: Pos[] = [];
  const stack: Pos[] = [start];
  while (stack.length > 0) {
    const p = stack.pop()!;
    const k = `${p.x},${p.y}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (q.terrainAt(p) !== terrain) continue;
    out.push(p);
    for (const d of ADJACENT) stack.push({ x: p.x + d.x, y: p.y + d.y });
  }
  return out;
}

/** "Enchantment": a visible active spell on the minion or on its group. */
export function hasEnchantments(q: QueryContext, m: Minion): boolean {
  return q.state.spells.some(
    (sp) =>
      sp.visible &&
      ((sp.host.kind === 'minion' && sp.host.id === m.id) || (sp.host.kind === 'group' && sp.host.id === m.groupId)),
  );
}
