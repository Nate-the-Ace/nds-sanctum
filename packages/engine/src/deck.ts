import type { Engine } from './engine';
import type { Side } from './types';

/** Draw up to `n` cards. Running out of cards has no penalty. */
export function drawCards(e: Engine, side: Side, n: number): void {
  const p = e.state.players[side];
  for (let i = 0; i < n && p.deck.length > 0; i++) p.hand.push(p.deck.shift()!);
}
