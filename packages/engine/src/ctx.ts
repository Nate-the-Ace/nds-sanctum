import { key } from './board';
import { applyDamage } from './damage';
import { killMinion } from './death';
import type { Engine } from './engine';
import type { GameEvent } from './events';
import { groupAt, hostile, minionsOf, structureAt } from './query';
import { nextRandom } from './rng';
import { computeStats, type Stats } from './stats';
import type { ActiveSpell, GameState, Group, Minion, PlayerId, Pos, Ref, Structure, TerrainId } from './types';

/** Read-only view handed to canCast / persistent / stats callbacks. */
export interface QueryContext {
  readonly caster: PlayerId;
  readonly state: Readonly<GameState>;
  minion(id: number): Minion | undefined;
  group(id: number): Group | undefined;
  structure(id: number): Structure | undefined;
  groupAt(pos: Pos): Group | undefined;
  structureAt(pos: Pos): Structure | undefined;
  terrainAt(pos: Pos): TerrainId | undefined;
  minionsOf(groupId: number): Minion[];
  stats(minionId: number): Stats;
  hostile(a: Group, b: Group): boolean;
}

/** Handed to onCast and event handlers. Scripts change the game only through these methods. */
export interface EventContext extends QueryContext {
  readonly spell: ActiveSpell;
  readonly host: Ref;
  readonly event: GameEvent | undefined;
  random(): number;
  /** Marks the current event cancelled (`event.data.cancel = true`). */
  cancel(): void;
  token(name: string): number;
  setToken(name: string, value: number): void;
  /** Magical spell damage (ignores armor by default). Nobody is blamed, so a death is a "dies" death. */
  damage(minionId: number, amount: number, opts?: { ignoresArmor?: boolean }): void;
  heal(minionId: number, amount: number): void;
  /** Instant death ("dies" category). */
  kill(minionId: number): void;
}

export function makeQuery(e: Engine, caster: PlayerId): QueryContext {
  const s = e.state;
  return {
    caster,
    state: s,
    minion: (id) => s.minions[id],
    group: (id) => s.groups[id],
    structure: (id) => s.structures[id],
    groupAt: (pos) => groupAt(s, pos),
    structureAt: (pos) => structureAt(s, pos),
    terrainAt: (pos) => s.terrain[key(pos)],
    minionsOf: (id) => minionsOf(s, id),
    stats: (id) => computeStats(e, id),
    hostile,
  };
}

export function makeCtx(e: Engine, spell: ActiveSpell, event?: GameEvent): EventContext {
  return {
    ...makeQuery(e, spell.owner),
    spell,
    host: spell.host,
    event,
    random: () => nextRandom(e.state),
    cancel: () => {
      if (event) event.data.cancel = true;
    },
    token: (name) => spell.tokens[name] ?? 0,
    setToken: (name, value) => {
      spell.tokens[name] = value;
    },
    damage: (id, amount, opts) => applyDamage(e, id, amount, opts),
    heal: (id, amount) => {
      const m = e.state.minions[id];
      if (m && m.status !== 'dead') m.hp = Math.min(m.maxHp, m.hp + Math.max(0, amount));
    },
    kill: (id) => {
      killMinion(e, id, null, 'dies');
    },
  };
}
