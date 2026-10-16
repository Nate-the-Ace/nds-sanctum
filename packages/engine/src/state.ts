import { createCells } from './board';
import { emptyPool } from './types';
import type { GameState, HouseId, PlayerState, Side, TerrainId } from './types';

function player(id: Side, house: HouseId): PlayerState {
  return { id, house, mana: emptyPool(), deck: [], hand: [], discard: [], orders: null, confirmed: false, heroesCast: [] };
}

/** Flat plains board, no structures, no units. Red has initiative. */
export function blankState(seed: number, houses: Record<Side, HouseId> = { red: 'war', blue: 'war' }): GameState {
  const cells = createCells();
  const terrain: Record<string, TerrainId> = {};
  for (const k of cells) terrain[k] = 'plains';
  return {
    turn: 1, phase: 'orders', initiative: 'red', winner: null, seed,
    cells, terrain,
    structures: {}, groups: {}, minions: {}, spells: [], graveyard: [],
    groupSeq: { red: [], blue: [], neutral: [] },
    players: { red: player('red', houses.red), blue: player('blue', houses.blue) },
    pendingMana: [], nextId: 1, log: [],
  };
}
