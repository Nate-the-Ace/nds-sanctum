import { DIR_LIST, isSanctumArea, key, samePos, step } from './board';
import { applyDamage } from './damage';
import { killMinion } from './death';
import type { Engine } from './engine';
import { dispatch, type GameEvent } from './events';
import { groupAt, hostile, minionsOf, structureAt } from './query';
import { nextRandom } from './rng';
import { computeStats, syncHp, type Stats } from './stats';
import { drawCards } from './deck';
import { addSpellRecord } from './spellstore';
import { dispel, recheck, recheckSquare } from './spells';
import { canEnterSquare, entryBlocked } from './movement';
import { checkFatal, groupCanEnter } from './terrainfx';
import { RULES } from './rules';
import { changeNation, flipGroup, joinGroup, placeRecruit, removeGroup, setGroupOwner, summonGroup } from './units';
import type { ActiveSpell, Dir, GameState, Group, Mana, Minion, MinionSpec, Nation, PlayerId, Pos, Ref, Side, Structure, SummonDef, TerrainId } from './types';

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
  /** Ends the current combat (the group "withdraws"). Valid in `combat:start` and `round:start` handlers. */
  endCombat(): void;
  token(name: string): number;
  setToken(name: string, value: number): void;
  /** Sets which side has the initiative. Use from an `initiative:decide` handler. */
  setInitiative(side: Side): void;
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
  /** Raises a minion's base level by `n` (permanent; level stays within 0..5). */
  addLevel(minionId: number, n: number): void;
  /** Removes the top card of a player's deck from the game. Returns it, or undefined when the deck is empty. */
  removeTopCard(side: Side): string | undefined;
  /** Tells player `to` the top card of `side`'s deck (in `players[to].intel` until the next start of turn). */
  reveal(to: Side, side: Side): void;
  /** Adds a card (a recursive copy) to a player's hand. Throws on an unknown card id. */
  addToHand(side: Side, cardId: string): void;
  /**
   * Cast an engine-owned helper spell onto a host, ignoring targeting rules and exclusivity. Owner defaults to this
   * spell's owner; `turns` overrides the helper card's duration. Returns the new spell's id.
   */
  createSpell(cardId: string, host: Ref, opts?: { owner?: PlayerId; turns?: number | null; tokens?: Record<string, number> }): number;
  /** Adds a minion to a group. Returns its id, or null when the group is full or gone. */
  addMinion(groupId: number, spec: MinionSpec): number | null;
  /** Creates a recruit on a structure's square (joins the friendly player group there). Null when blocked or full. */
  createRecruit(structureId: number, spec: MinionSpec): number | null;
  /** Adds novices (up to the maximum) to a structure; `nation` marks them to train as that nation. */
  addNovices(structureId: number, count: number, nation?: Nation): void;
  /** The group changes sides. */
  changeSides(groupId: number): void;
  /** The group (and its minions) now belongs to `owner`, neutral included; spells on it keep their owners. */
  setOwner(groupId: number, owner: PlayerId): void;
  /** Player or computer control. A computer group moves by the bot of card `botId` (default: this spell's card). */
  setControl(groupId: number, control: 'player' | 'computer', botId?: string | null): void;
  /** The minion changes nation (permanent): new house; a recruit takes the new nation's hit points and walks. */
  setNation(minionId: number, nation: Nation): void;
  /** Changes a square's terrain. Structures and Sanctum squares are immune. Fatal terrain applies at once. */
  setTerrain(pos: Pos, terrain: TerrainId): void;
  /** Overwrite a group's movement order for this turn (null cancels it). */
  setMoveOrder(groupId: number, dir: Dir | null): void;
  /** "Moves twice": repeat the order in a second movement pass. */
  setMovesTwice(groupId: number, value?: boolean): void;
  /** Directions the group could step into right now (square exists, terrain and structure rules allow it). */
  legalDirections(groupId: number): Dir[];
  /** Whether the group's minions can all enter `pos` (square exists, terrain allows it, no spell forbids it). */
  canEnter(groupId: number, pos: Pos): boolean;
  /** Relocate a group to an empty square without moving through the squares between. Does nothing if occupied. */
  moveGroup(groupId: number, pos: Pos): void;
  /** The group leaves the board ("disappears"). Its spells are suspended until it appears again. */
  hide(groupId: number): void;
  /** An off-board group appears on an empty square, not by moving: no movement events. Returns whether it did. */
  appear(groupId: number, pos: Pos): boolean;
  /** Removes a group from the game, on or off the board: its minions are removed without death events. */
  removeGroup(groupId: number): void;
  /** Sets a monster group's home square. */
  setHome(groupId: number, pos: Pos): void;
}

/** What a card's `bot` sees: the query view plus a random source and the legal steps of a group. */
export interface BotContext extends QueryContext {
  random(): number;
  legalDirections(groupId: number): Dir[];
}

function legalDirs(e: Engine, id: number): Dir[] {
  const g = e.state.groups[id];
  if (!g || !g.pos) return [];
  const from = g.pos;
  return DIR_LIST.filter((d) => canEnterSquare(e, g, step(from, d)));
}

export function makeBotContext(e: Engine, owner: PlayerId): BotContext {
  return { ...makeQuery(e, owner), random: () => nextRandom(e.state), legalDirections: (id) => legalDirs(e, id) };
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
    endCombat: () => {
      if (event) event.data.endCombat = true;
    },
    addMana: (side, mana, amount) => {
      e.state.players[side].mana[mana] += amount;
    },
    token: (name) => spell.tokens[name] ?? 0,
    setToken: (name, value) => {
      spell.tokens[name] = value;
    },
    setInitiative: (side) => {
      e.state.initiative = side;
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
    addLevel: (id, n) => {
      const m = e.state.minions[id];
      if (!m || m.status === 'dead') return;
      m.base.level = Math.max(0, Math.min(RULES.maxLevel, m.base.level + n));
    },
    removeTopCard: (side) => e.state.players[side].deck.shift(),
    reveal: (to, side) => {
      const top = e.state.players[side].deck[0];
      if (top === undefined) return;
      const p = e.state.players[to];
      p.intel = [...(p.intel ?? []), { source: spell.cardId, side, cardId: top }];
    },
    addToHand: (side, cardId) => {
      if (!e.cards[cardId]) throw new Error(`addToHand: unknown card "${cardId}"`);
      e.state.players[side].hand.push(cardId);
    },
    createSpell: (cardId, host, opts) => {
      const card = e.cards[cardId];
      if (!card) throw new Error(`createSpell: unknown card "${cardId}"`);
      const made = addSpellRecord(e.state, {
        cardId, owner: opts?.owner ?? spell.owner, host, visible: card.visible !== false,
        turnsLeft: opts?.turns !== undefined ? opts.turns : (card.duration?.turns ?? null), tokens: { ...opts?.tokens },
      });
      recheck(e, host);
      syncHp(e);
      return made.id;
    },
    addMinion: (groupId, spec) => joinGroup(e, groupId, spec)?.id ?? null,
    createRecruit: (structureId, spec) => {
      const st = e.state.structures[structureId];
      if (!st || st.owner === 'neutral') return null;
      const m = placeRecruit(e, st.owner, st.pos, spec);
      if (!m) return null;
      dispatch(e, 'minion:created', { kind: 'structure', id: structureId }, { minionId: m.id });
      return m.id;
    },
    addNovices: (structureId, count, nation) => {
      const st = e.state.structures[structureId];
      if (!st) return;
      const added = Math.max(0, Math.min(count, RULES.maxNovices - st.novices));
      st.novices += added;
      if (nation) st.noviceNations = [...(st.noviceNations ?? []), ...Array<Nation>(added).fill(nation)];
    },
    changeSides: (groupId) => flipGroup(e, groupId),
    setOwner: (groupId, owner) => setGroupOwner(e, groupId, owner),
    setControl: (groupId, control, botId) => {
      const g = e.state.groups[groupId];
      if (!g) return;
      g.control = control;
      g.botId = control === 'computer' ? (botId === undefined ? spell.cardId : botId) : null;
      g.moveOrder = null;
      g.moveSeq = null;
    },
    setNation: (id, nation) => {
      changeNation(e, id, nation);
      syncHp(e);
    },
    setTerrain: (pos, terrain) => {
      const s = e.state;
      if (!s.cells.includes(key(pos)) || isSanctumArea(pos) || structureAt(s, pos)) return;
      s.terrain[key(pos)] = terrain;
      const g = groupAt(s, pos);
      if (g) checkFatal(e, g);
      recheckSquare(e, pos);
    },
    setMoveOrder: (id, dir) => {
      const g = e.state.groups[id];
      if (g) g.moveOrder = dir;
    },
    setMovesTwice: (id, value = true) => {
      const g = e.state.groups[id];
      if (g) g.movesTwice = value;
    },
    legalDirections: (id) => legalDirs(e, id),
    canEnter: (id, pos) => {
      const g = e.state.groups[id];
      return !!g && e.state.cells.includes(key(pos)) && groupCanEnter(e, g, e.state.terrain[key(pos)]) && !entryBlocked(e, g, pos);
    },
    moveGroup: (id, pos) => {
      const s = e.state;
      const g = s.groups[id];
      if (!g || !g.pos || !s.cells.includes(key(pos))) return;
      const other = groupAt(s, pos);
      if (other && other.id !== id) return;
      const from = g.pos;
      g.pos = { ...pos };
      checkFatal(e, g);
      recheckSquare(e, from);
      recheckSquare(e, pos);
      if (!samePos(from, pos) && s.groups[id]?.pos) {
        const ref = { kind: 'group' as const, id };
        dispatch(e, 'group:exit', ref, { from });
        dispatch(e, 'group:move', ref, { from, to: g.pos });
        dispatch(e, 'group:enter', ref, { to: g.pos });
      }
    },
    hide: (id) => {
      const g = e.state.groups[id];
      if (!g || !g.pos) return;
      const from = g.pos;
      g.pos = null;
      g.moveOrder = null;
      recheckSquare(e, from);
    },
    appear: (id, pos) => {
      const s = e.state;
      const g = s.groups[id];
      if (!g || g.pos !== null || !s.cells.includes(key(pos)) || groupAt(s, pos) || structureAt(s, pos)) return false;
      g.pos = { ...pos };
      checkFatal(e, g);
      recheckSquare(e, pos);
      return true;
    },
    removeGroup: (id) => {
      const g = e.state.groups[id];
      if (!g) return;
      for (const mid of [...g.minionIds]) killMinion(e, mid, null, 'removed');
      if (e.state.groups[id]) removeGroup(e, id); // an empty group
    },
    setHome: (id, pos) => {
      const g = e.state.groups[id];
      if (g) g.home = { ...pos };
    },
  };
}
