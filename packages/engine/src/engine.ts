import type { CardIndex } from './cards';
import type { GameState } from './types';

/** Internal mutable draft: a cloned state plus the card index. Public API functions build one per call. */
export interface Engine {
  state: GameState;
  cards: CardIndex;
}

export function makeEngine(state: GameState, cards: CardIndex): Engine {
  return { state: structuredClone(state), cards };
}
