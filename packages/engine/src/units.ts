import type { Engine } from './engine';
import { groupAt } from './query';
import { applyNation, NATIONS } from './nations';
import { RULES, recruitBase } from './rules';
import { removeSpellsOn } from './spellstore';
import type { Group, Minion, MinionSpec, Nation, PlayerId, Pos, Side, SummonDef } from './types';

export function recruitSpec(cls: 'swordsman' | 'archer', nation?: Nation): MinionSpec {
  const base = recruitBase(cls);
  if (!nation) return { kind: 'recruit', cls, name: cls, base };
  return { kind: 'recruit', cls, name: cls, base: applyNation(base, nation), nation, house: NATIONS[nation].house };
}

/** A minion changes nation: it serves the new nation's house; a recruit swaps its nation hit points and walks. */
export function changeNation(e: Engine, minionId: number, nation: Nation): void {
  const m = e.state.minions[minionId];
  if (!m || m.status === 'dead') return;
  if (m.kind === 'recruit') {
    const walks = [...m.base.walks];
    for (const w of m.nation ? NATIONS[m.nation].walks : []) {
      const i = walks.indexOf(w);
      if (i >= 0) walks.splice(i, 1);
    }
    m.base = { ...m.base, hp: NATIONS[nation].hp, walks: [...walks, ...NATIONS[nation].walks] };
  }
  m.nation = nation;
  m.house = NATIONS[nation].house;
}

export function createGroup(
  e: Engine, owner: PlayerId, pos: Pos | null, kind: 'recruit' | 'monster', control: 'player' | 'computer', botId: string | null = null,
): Group {
  const s = e.state;
  const g: Group = {
    id: s.nextId++, kind, owner, minionIds: [], pos: pos ? { ...pos } : null, control, botId,
    moveOrder: null, moveSeq: null, movesTwice: false, home: kind === 'monster' && pos ? { ...pos } : null,
  };
  s.groups[g.id] = g;
  s.groupSeq[owner].push(g.id);
  return g;
}

export function spawnMinion(e: Engine, groupId: number, spec: MinionSpec): Minion {
  const s = e.state;
  const g = s.groups[groupId];
  const m: Minion = {
    id: s.nextId++, kind: spec.kind, cls: spec.cls, name: spec.name, owner: g.owner, groupId,
    hp: spec.base.hp, maxHp: spec.base.hp, base: { ...spec.base, walks: [...spec.base.walks] },
    status: 'alive', expQualified: false, hasExp: false, nation: spec.nation ?? null, house: spec.house ?? null,
    combat: { armor: 0, handLeft: 0, missileLeft: 0, misses: 0, victim: null },
  };
  s.minions[m.id] = m;
  g.minionIds.push(m.id);
  return m;
}

/** New recruit joins the friendly player-controlled recruit group in the square if it has room, else starts a group. */
export function addRecruit(e: Engine, owner: Side, pos: Pos, cls: 'swordsman' | 'archer', nation?: Nation): Minion {
  const existing = groupAt(e.state, pos);
  const usable =
    existing && existing.owner === owner && existing.kind === 'recruit' &&
    existing.control === 'player' && existing.minionIds.length < RULES.maxGroup;
  const g = usable ? existing : createGroup(e, owner, pos, 'recruit', 'player');
  return spawnMinion(e, g.id, recruitSpec(cls, nation));
}

/**
 * Adds a minion to an existing group; null when the group is gone or full. Only living members take room: during a
 * death event the dying minion is still listed but its place is already free.
 */
export function joinGroup(e: Engine, groupId: number, spec: MinionSpec): Minion | null {
  const g = e.state.groups[groupId];
  if (!g || g.minionIds.filter((id) => e.state.minions[id]?.status !== 'dead').length >= RULES.maxGroup) return null;
  return spawnMinion(e, groupId, spec);
}

/** Recruit created on a square: joins the friendly player group there or starts one. Null when the square is blocked. */
export function placeRecruit(e: Engine, owner: Side, pos: Pos, spec: MinionSpec): Minion | null {
  const existing = groupAt(e.state, pos);
  if (!existing) {
    const g = createGroup(e, owner, pos, 'recruit', 'player');
    return spawnMinion(e, g.id, spec);
  }
  const usable = existing.owner === owner && existing.kind === 'recruit' && existing.control === 'player';
  return usable ? joinGroup(e, existing.id, spec) : null;
}

/** Flips a recruit or monster group to the other side (minions and the spells on them go with it). */
export function flipGroup(e: Engine, groupId: number): void {
  const s = e.state;
  const g = s.groups[groupId];
  if (!g || g.owner === 'neutral') return;
  const to: Side = g.owner === 'red' ? 'blue' : 'red';
  s.groupSeq[g.owner] = s.groupSeq[g.owner].filter((id) => id !== groupId);
  s.groupSeq[to].push(groupId);
  g.owner = to;
  for (const mid of g.minionIds) if (s.minions[mid]) s.minions[mid].owner = to;
  for (const sp of s.spells) {
    const onGroup = sp.host.kind === 'group' && sp.host.id === groupId;
    const onMinion = sp.host.kind === 'minion' && g.minionIds.includes(sp.host.id);
    if (onGroup || onMinion) sp.owner = to;
  }
}

/** Gives a group (and its minions) to `owner`, neutral included. Spells on it keep their owners. */
export function setGroupOwner(e: Engine, groupId: number, owner: PlayerId): void {
  const s = e.state;
  const g = s.groups[groupId];
  if (!g || g.owner === owner) return;
  s.groupSeq[g.owner] = s.groupSeq[g.owner].filter((id) => id !== groupId);
  s.groupSeq[owner].push(groupId);
  g.owner = owner;
  for (const mid of g.minionIds) if (s.minions[mid]) s.minions[mid].owner = owner;
}

/** Deletes a group record and its group spells. Does not touch its minions. */
export function removeGroup(e: Engine, groupId: number): void {
  const s = e.state;
  const g = s.groups[groupId];
  if (!g) return;
  delete s.groups[groupId];
  s.groupSeq[g.owner] = s.groupSeq[g.owner].filter((id) => id !== groupId);
  removeSpellsOn(s, { kind: 'group', id: groupId });
}

export function summonGroup(e: Engine, def: SummonDef): Group {
  const kind = def.minions.every((m) => m.kind === 'recruit') ? 'recruit' : 'monster';
  const g = createGroup(e, def.owner, def.pos, kind, def.control ?? 'computer', def.botId ?? null);
  for (const spec of def.minions) spawnMinion(e, g.id, spec);
  return g;
}
