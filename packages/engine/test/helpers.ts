import { makeEngine, type Engine } from '../src/engine';
import { indexCards, type CardDef } from '../src/cards';
import { blankState } from '../src/state';
import { createGroup, recruitSpec, spawnMinion } from '../src/units';
import type { Group, PlayerId, Pos } from '../src/types';

/** Flat plains board, no structures or units. */
export function blankEngine(defs: CardDef[] = []): Engine {
  return makeEngine(blankState(1), indexCards(defs));
}

export function put(
  e: Engine, owner: PlayerId, pos: Pos, classes: Array<'swordsman' | 'archer'>, control: 'player' | 'computer' = 'player',
): Group {
  const g = createGroup(e, owner, pos, 'recruit', control);
  for (const c of classes) spawnMinion(e, g.id, recruitSpec(c));
  return g;
}
