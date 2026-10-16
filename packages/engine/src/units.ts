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

export function createGroup(
  e: Engine, owner: PlayerId, pos: Pos, kind: 'recruit' | 'monster', control: 'player' | 'computer', botId: string | null = null,
): Group {
  const s = e.state;
  const g: Group = { id: s.nextId++, kind, owner, minionIds: [], pos: { ...pos }, control, botId, moveOrder: null, moveSeq: null, movesTwice: false };
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
