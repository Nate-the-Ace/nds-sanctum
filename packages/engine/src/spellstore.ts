import { sameRef } from './query';
import type { ActiveSpell, GameState, Ref } from './types';

export function addSpellRecord(s: GameState, rec: Omit<ActiveSpell, 'id'>): ActiveSpell {
  const sp: ActiveSpell = { id: s.nextId++, ...rec };
  s.spells.push(sp);
  return sp;
}

export function removeSpellRecord(s: GameState, id: number): ActiveSpell | undefined {
  const i = s.spells.findIndex((sp) => sp.id === id);
  if (i < 0) return undefined;
  return s.spells.splice(i, 1)[0];
}

/** Silently drops every spell on a host (host died or left play). */
export function removeSpellsOn(s: GameState, ref: Ref): void {
  s.spells = s.spells.filter((sp) => !sameRef(sp.host, ref));
}
