import { key, samePos } from './board';
import type { ActiveSpell, GameState, Group, Minion, PlayerId, Pos, Ref, Side, Structure } from './types';

export const otherSide = (s: Side): Side => (s === 'red' ? 'blue' : 'red');

/** Initiative sequence: initiative, non-initiative, neutral. */
export function sequence(s: GameState): PlayerId[] {
  return [s.initiative, otherSide(s.initiative), 'neutral'];
}

/** Combat/voting precedence rank: initiative 0, neutral 1, non-initiative 2. */
export function ownerRank(s: GameState, owner: PlayerId): number {
  return owner === s.initiative ? 0 : owner === 'neutral' ? 1 : 2;
}

export function groupsAt(s: GameState, pos: Pos): Group[] {
  return Object.values(s.groups).filter((g) => g.pos !== null && samePos(g.pos, pos));
}

export function groupAt(s: GameState, pos: Pos): Group | undefined {
  return groupsAt(s, pos)[0];
}

export function structureAt(s: GameState, pos: Pos): Structure | undefined {
  return Object.values(s.structures).find((st) => samePos(st.pos, pos));
}

/** Live (not dead) members of a group, in group order. */
export function minionsOf(s: GameState, groupId: number): Minion[] {
  const g = s.groups[groupId];
  if (!g) return [];
  return g.minionIds.map((id) => s.minions[id]).filter((m): m is Minion => !!m && m.status !== 'dead');
}

/** Groups are hostile when owned by different players; neutral groups are hostile even to each other. */
export function hostile(a: Group, b: Group): boolean {
  if (a.id === b.id) return false;
  return a.owner !== b.owner || a.owner === 'neutral';
}

export function sameRef(a: Ref, b: Ref): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'minion':
    case 'group':
    case 'structure':
      return a.id === (b as typeof a).id;
    case 'square':
      return samePos(a.pos, (b as typeof a).pos);
    case 'globe':
      return true;
  }
}

export function spellsOn(s: GameState, ref: Ref): ActiveSpell[] {
  return s.spells.filter((sp) => sameRef(sp.host, ref));
}

export function minionPos(s: GameState, m: Minion): Pos | null {
  return s.groups[m.groupId]?.pos ?? null;
}

export function isConcealed(s: GameState, m: Minion): boolean {
  const p = minionPos(s, m);
  return p !== null && s.terrain[key(p)] === 'forest';
}
