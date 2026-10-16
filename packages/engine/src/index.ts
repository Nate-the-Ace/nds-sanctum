export const ENGINE_VERSION = '0.1.0';

export { createGame, validateDeck, submitOrders, confirmOrders, chooseMana } from './api';
export type { GameConfig, DeckConfig, Result } from './api';
export { defineCard, indexCards } from './cards';
export type { CardDef, CardIndex, CastAttempt, SpellType, TargetType } from './cards';
export type { BotContext, EventContext, QueryContext } from './ctx';
export type { EventType, GameEvent } from './events';
export type { Stats, StatDelta } from './stats';
export { HOUSES, houseMana } from './houses';
export { RULES } from './rules';
export { NATIONS, NATION_LIST, nationOfHouse } from './nations';
export { recruitSpec } from './units';
export { validateOrders } from './orders';
export { createCells, SANCTUM_POS, sanctumSquares, entrances, step, DIR_LIST, key, isSanctumArea } from './board';
export { emptyOrders, emptyPool, MANA_TYPES, SIDES } from './types';
export type {
  ActiveSpell, BaseStats, Dir, GameState, Group, HouseId, LogEntry, Mana, ManaPool, Minion, MinionSpec, Nation,
  Orders, PlayerId, PlayerState, Pos, Ref, Side, Structure, SummonDef, TerrainId, Walk,
  TrainOrder, CastOrder, MoveOrder,
} from './types';
