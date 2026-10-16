import type { CardDef, Group, PlayerId, Pos } from '@sanctum/engine';
import {
  blankState, createGroup, executeCast, indexCards, makeEngine, recruitSpec, spawnMinion, type Engine,
} from '@sanctum/engine/src/testing';

/** A flat blank board with only the given cards registered. */
export const mini = (defs: CardDef[]): Engine => makeEngine(blankState(1), indexCards(defs));

export function put(e: Engine, owner: PlayerId, pos: Pos, classes: Array<'swordsman' | 'archer'>): Group {
  const g = createGroup(e, owner, pos, 'recruit', 'player');
  for (const c of classes) spawnMinion(e, g.id, recruitSpec(c));
  return g;
}

export const castMini = (e: Engine, who: 'red' | 'blue', id: string, target: Parameters<typeof executeCast>[3]) =>
  executeCast(e, who, id, target);
