import { isSanctumArea, key } from './board';
import { applyDamage } from './damage';
import { killMinion } from './death';
import type { Engine } from './engine';
import type { GameEvent } from './events';
import { groupAt, hostile, minionsOf, structureAt } from './query';
import { nextRandom } from './rng';
import { computeStats, syncHp, type Stats } from './stats';
import { drawCards } from './deck';
import { addSpellRecord } from './spellstore';
import { dispel, recheck, recheckSquare } from './spells';
import { checkFatal } from './terrainfx';
import { summonGroup } from './units';
import type { ActiveSpell, GameState, Group, Mana, Minion, PlayerId, Pos, Ref, Side, Structure, SummonDef, TerrainId } from './types';

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
  /** Adds mana to a player's pool for this turn. Use from a `mana:generate` handler. */
  addMana(side: Side, mana: Mana, amount: number): void;
  /** Spell damage. Magical by default (ignores armor); pass `{ magical: false }` for damage that respects armor and fires beforeArmor handlers. Nobody is blamed, so a death is a "dies" death. */
  damage(minionId: number, amount: number, opts?: { magical?: boolean }): void;
  heal(minionId: number, amount: number): void;
  /** Instant death ("dies" category). */
  kill(minionId: number): void;
  /** Dispels the given active spell (default: this spell). */
  dispel(spellId?: number): void;
  /** Creates a group at a square; returns its id. Owner defaults to this spell's owner; the group's bot is this card's `bot`. */
  summon(def: Omit<SummonDef, 'owner'> & { owner?: PlayerId }): number;
  draw(side: Side, count: number): void;
  /**
   * Cast an engine-owned helper spell onto a host, ignoring targeting rules and exclusivity. Owner defaults to this
   * spell's owner; `turns` overrides the helper card's duration. Returns the new spell's id.
   */
  createSpell(cardId: string, host: Ref, opts?: { owner?: PlayerId; turns?: number | null }): number;
  /** Changes a square's terrain. Structures and Sanctum squares are immune. Fatal terrain applies at once. */
  setTerrain(pos: Pos, terrain: TerrainId): void;
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
    addMana: (side, mana, amount) => {
      e.state.players[side].mana[mana] += amount;
    },
    token: (name) => spell.tokens[name] ?? 0,
    setToken: (name, value) => {
      spell.tokens[name] = value;
    },
    damage: (id, amount, opts) => applyDamage(e, id, amount, opts),
    heal: (id, amount) => {
      const m = e.state.minions[id];
      if (!m || m.status === 'dead') return;
      m.maxHp = computeStats(e, id).maxHp;
      m.hp = Math.min(m.maxHp, m.hp + Math.max(0, amount));
    },
    kill: (id) => {
      killMinion(e, id, null, 'dies');
    },
    dispel: (id) => dispel(e, id ?? spell.id),
    summon: (def) =>
      summonGroup(e, { ...def, owner: def.owner ?? spell.owner, botId: def.botId ?? spell.cardId }).id,
    draw: (side, count) => drawCards(e, side, count),
    createSpell: (cardId, host, opts) => {
      const card = e.cards[cardId];
      if (!card) throw new Error(`createSpell: unknown card "${cardId}"`);
      const made = addSpellRecord(e.state, {
        cardId, owner: opts?.owner ?? spell.owner, host, visible: card.visible !== false,
        turnsLeft: opts?.turns !== undefined ? opts.turns : (card.duration?.turns ?? null), tokens: {},
      });
      recheck(e, host);
      syncHp(e);
      return made.id;
    },
    setTerrain: (pos, terrain) => {
      const s = e.state;
      if (!s.cells.includes(key(pos)) || isSanctumArea(pos) || structureAt(s, pos)) return;
      s.terrain[key(pos)] = terrain;
      const g = groupAt(s, pos);
      if (g) checkFatal(e, g);
      recheckSquare(e, pos);
    },
  };
}
