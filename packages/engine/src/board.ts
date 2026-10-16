import type { Dir, Pos, Side } from './types';

export const BOARD_SIZE = 10;
const REMOVED = new Set(['0,0', '1,0', '0,1', '9,9', '8,9', '9,8']);

export const SANCTUM_POS: Record<Side, Pos> = { red: { x: 2, y: 2 }, blue: { x: 7, y: 7 } };
export const DIRS: Record<Dir, Pos> = { n: { x: 0, y: -1 }, e: { x: 1, y: 0 }, s: { x: 0, y: 1 }, w: { x: -1, y: 0 } };
export const DIR_LIST: Dir[] = ['n', 'e', 's', 'w'];

export const key = (p: Pos): string => `${p.x},${p.y}`;
export const parseKey = (k: string): Pos => {
  const [x, y] = k.split(',').map(Number);
  return { x, y };
};
export const samePos = (a: Pos, b: Pos): boolean => a.x === b.x && a.y === b.y;

export function createCells(): string[] {
  const out: string[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const k = `${x},${y}`;
      if (!REMOVED.has(k)) out.push(k);
    }
  }
  return out;
}

export function step(p: Pos, d: Dir): Pos {
  return { x: p.x + DIRS[d].x, y: p.y + DIRS[d].y };
}

export function neighborPositions(p: Pos): Array<{ dir: Dir; pos: Pos }> {
  return DIR_LIST.map((dir) => ({ dir, pos: step(p, dir) }));
}

export function rotate(p: Pos): Pos {
  return { x: BOARD_SIZE - 1 - p.x, y: BOARD_SIZE - 1 - p.y };
}

export function entrances(side: Side): Pos[] {
  return DIR_LIST.map((d) => step(SANCTUM_POS[side], d));
}

export function sanctumSquares(side: Side): Pos[] {
  return [SANCTUM_POS[side], ...entrances(side)];
}

export function distance2(a: Pos, b: Pos): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

/** The line equidistant between the two Sancta. */
export function onCenterline(p: Pos): boolean {
  return p.x + p.y === BOARD_SIZE - 1;
}

export function isEdge(p: Pos): boolean {
  return p.x === 0 || p.y === 0 || p.x === BOARD_SIZE - 1 || p.y === BOARD_SIZE - 1;
}

export function isSanctumArea(p: Pos): boolean {
  return (['red', 'blue'] as Side[]).some((s) => sanctumSquares(s).some((q) => samePos(p, q)));
}
