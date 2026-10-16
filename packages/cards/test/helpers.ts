import type { Group, MinionSpec, PlayerId, Pos, Ref } from '@sanctum/engine';
import {
  blankState, computeStats, createGroup, executeCast, indexCards, makeEngine, recruitSpec, spawnMinion, type Engine,
} from '@sanctum/engine/src/testing';
import { allCards } from '../src/index';

/** Flat plains board, no structures, every implemented card registered. */
export const world = (): Engine => makeEngine(blankState(1), indexCards(allCards));

export function put(
  e: Engine, owner: PlayerId, pos: Pos, classes: Array<'swordsman' | 'archer'>, control: 'player' | 'computer' = 'player',
): Group {
  const g = createGroup(e, owner, pos, 'recruit', control);
  for (const c of classes) spawnMinion(e, g.id, recruitSpec(c));
  return g;
}

export const OGRE: MinionSpec = {
  kind: 'monster', cls: 'monster', name: 'ogre',
  base: { hp: 12, level: 1, armor: 0, hand: 2, handAttacks: 1, missile: 0, missileAttacks: 0, walks: [] },
};

export function putMonster(e: Engine, owner: PlayerId, pos: Pos): Group {
  const g = createGroup(e, owner, pos, 'monster', 'computer');
  spawnMinion(e, g.id, OGRE);
  return g;
}

export const cast = (e: Engine, who: 'red' | 'blue', id: string, target: Ref) => executeCast(e, who, id, target);
export const mref = (id: number): Ref => ({ kind: 'minion', id });
export const gref = (id: number): Ref => ({ kind: 'group', id });
export const sref = (x: number, y: number): Ref => ({ kind: 'square', pos: { x, y } });
export const stats = (e: Engine, id: number) => computeStats(e, id);
