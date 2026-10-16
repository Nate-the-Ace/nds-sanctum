export type Side = 'red' | 'blue';
export type PlayerId = Side | 'neutral';
export const SIDES: Side[] = ['red', 'blue'];

export type Mana = 'clarity' | 'mystery' | 'order' | 'strife' | 'will' | 'world';
export const MANA_TYPES: Mana[] = ['clarity', 'mystery', 'order', 'strife', 'will', 'world'];
export type ManaPool = Record<Mana, number>;
export const emptyPool = (): ManaPool => ({ clarity: 0, mystery: 0, order: 0, strife: 0, will: 0, world: 0 });

export type TerrainId =
  | 'plains' | 'barren' | 'forest' | 'ice' | 'mountain' | 'swamp'
  | 'desert' | 'lava' | 'volcano' | 'water' | 'void';
export type Walk = 'desert' | 'water' | 'mountain' | 'fire' | 'flight';

export interface Pos { x: number; y: number }
export type Dir = 'n' | 'e' | 's' | 'w';

export type HouseId =
  | 'abomination' | 'body' | 'death' | 'despair' | 'hope' | 'justice'
  | 'life' | 'making' | 'mind' | 'nature' | 'unmaking' | 'war';

export interface BaseStats {
  hp: number;
  level: number;
  armor: number;
  hand: number;
  handAttacks: number;
  missile: number;
  missileAttacks: number;
  walks: Walk[];
}

export type Nation =
  | 'imp' | 'cyclops' | 'keeper' | 'shadow' | 'vision' | 'gargoyle'
  | 'elf' | 'dwarf' | 'djinn' | 'satyr' | 'misfit' | 'human';

export interface MinionSpec {
  kind: 'recruit' | 'monster';
  cls: 'swordsman' | 'archer' | 'monster';
  name: string;
  base: BaseStats;
  nation?: Nation;
  house?: HouseId;
}

export interface SummonDef {
  owner: PlayerId;
  pos: Pos;
  control?: 'player' | 'computer';
  botId?: string | null;
  minions: MinionSpec[];
}

export type Ref =
  | { kind: 'minion'; id: number }
  | { kind: 'group'; id: number }
  | { kind: 'square'; pos: Pos }
  | { kind: 'structure'; id: number }
  | { kind: 'globe' };

export interface Minion {
  id: number;
  kind: 'recruit' | 'monster';
  cls: 'swordsman' | 'archer' | 'monster';
  name: string;
  owner: PlayerId;
  groupId: number;
  hp: number;
  maxHp: number;
  base: BaseStats;
  status: 'alive' | 'dying' | 'dead';
  expQualified: boolean;
  hasExp: boolean;
  nation: Nation | null;
  house: HouseId | null;
  combat: { armor: number; handLeft: number; missileLeft: number; misses: number; victim: number | null };
}

export interface Group {
  id: number;
  kind: 'recruit' | 'monster';
  owner: PlayerId;
  minionIds: number[];
  pos: Pos | null;
  control: 'player' | 'computer';
  botId: string | null;
  moveOrder: Dir | null;
  /** Index of this group's order within the player's issued move orders; null when none (voting tiebreak and pass-I order). */
  moveSeq: number | null;
  movesTwice: boolean;
}

export interface Structure {
  id: number;
  kind: 'sanctum' | 'town' | 'colony';
  pos: Pos;
  owner: PlayerId;
  manaType: Mana | null;
  novices: number;
  turnCount: number;
  captured: boolean;
}

export interface ActiveSpell {
  id: number;
  cardId: string;
  owner: PlayerId;
  host: Ref;
  visible: boolean;
  turnsLeft: number | null;
  tokens: Record<string, number>;
}

export interface TrainOrder { structureId: number; as: 'swordsman' | 'archer' | Mana }
export interface CastOrder { handIndex: number; target: Ref }
export interface MoveOrder { groupId: number; dir: Dir }
export interface Orders {
  train: TrainOrder[];
  cast: CastOrder[];
  move: MoveOrder[];
  discard: number | null;
}
export const emptyOrders = (): Orders => ({ train: [], cast: [], move: [], discard: null });

export interface PlayerState {
  id: Side;
  house: HouseId;
  mana: ManaPool;
  deck: string[];
  hand: string[];
  discard: string[];
  orders: Orders | null;
  confirmed: boolean;
}

export interface LogEntry { type: string; [key: string]: unknown }

export interface GameState {
  turn: number;
  phase: 'choose-mana' | 'orders' | 'over';
  initiative: Side;
  winner: Side | null;
  seed: number;
  cells: string[];
  terrain: Record<string, TerrainId>;
  structures: Record<number, Structure>;
  groups: Record<number, Group>;
  minions: Record<number, Minion>;
  spells: ActiveSpell[];
  graveyard: number[];
  groupSeq: Record<PlayerId, number[]>;
  players: Record<Side, PlayerState>;
  pendingMana: number[];
  nextId: number;
  log: LogEntry[];
}
