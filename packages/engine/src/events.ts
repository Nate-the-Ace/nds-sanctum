import { makeCtx } from './ctx';
import type { Engine } from './engine';
import { sequence, spellsOn, structureAt } from './query';
import type { ActiveSpell, GameState, Pos, Ref } from './types';

export type EventType =
  // untargeted (all players)
  | 'turn:start' | 'turn:startAfter' | 'movement:before' | 'movement:after' | 'combat:before' | 'turn:afterCombat'
  // group
  | 'group:exit' | 'group:move' | 'group:enter' | 'combat:start' | 'round:start' | 'combat:end' | 'combat:after'
  // minion
  | 'attack:beforeArmor' | 'attack:hit' | 'armor:after'
  | 'minion:dying' | 'minion:killed' | 'minion:dies'
  | 'attacker:hits' | 'attacker:damages' | 'attacker:kills';

export interface GameEvent {
  type: EventType;
  ref?: Ref;
  /** Mutable payload. Handlers may change documented fields (e.g. `damage`) or set `cancel`. */
  data: Record<string, any>;
}

/** Spells that see an event on `ref`, in bubbling order. */
function chain(s: GameState, ref: Ref): ActiveSpell[] {
  const out: ActiveSpell[] = [];
  const add = (r: Ref) => out.push(...spellsOn(s, r));
  let pos: Pos | null = null;
  if (ref.kind === 'minion') {
    const m = s.minions[ref.id];
    if (m) {
      add(ref);
      const g = s.groups[m.groupId];
      if (g) {
        add({ kind: 'group', id: g.id });
        pos = g.pos;
      }
    }
  } else if (ref.kind === 'group') {
    const g = s.groups[ref.id];
    if (g) {
      for (const mid of g.minionIds) add({ kind: 'minion', id: mid });
      add(ref);
      pos = g.pos;
    }
  } else if (ref.kind === 'structure') {
    pos = s.structures[ref.id]?.pos ?? null;
  } else if (ref.kind === 'square') {
    pos = ref.pos;
  }
  if (pos) {
    add({ kind: 'square', pos });
    const st = structureAt(s, pos);
    if (st) add({ kind: 'structure', id: st.id });
  }
  add({ kind: 'globe' });
  return out;
}

export function dispatch(e: Engine, type: EventType, ref?: Ref, data: Record<string, any> = {}): GameEvent {
  const s = e.state;
  const ev: GameEvent = { type, ref, data };
  const spells = ref ? chain(s, ref) : sequence(s).flatMap((p) => s.spells.filter((sp) => sp.owner === p));
  for (const sp of spells) {
    if (!s.spells.some((x) => x.id === sp.id)) continue; // dispelled by an earlier handler
    const fn = e.cards[sp.cardId]?.on?.[type];
    if (fn) fn(makeCtx(e, sp, ev), ev);
  }
  return ev;
}
