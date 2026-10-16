import { DIR_LIST, step, type Dir, type Pos, type TerrainId } from '@sanctum/engine';

export const TILE_W = 80;
export const TILE_H = 40;
/** The SVG viewBox that frames the whole diamond. */
export const VIEW = { x: -405, y: 15, w: 810, h: 330 };

/** Centre of a square on the diamond: x grows to the right-down, y to the left-down. */
export const project = (p: Pos): { x: number; y: number } => ({ x: ((p.x - p.y) * TILE_W) / 2, y: ((p.x + p.y) * TILE_H) / 2 });

export function diamondPoints(p: Pos, shrink = 0): string {
  const c = project(p);
  const w = TILE_W / 2 - shrink;
  const h = TILE_H / 2 - shrink / 2;
  return `${c.x},${c.y - h} ${c.x + w},${c.y} ${c.x},${c.y + h} ${c.x - w},${c.y}`;
}

export function dirBetween(from: Pos, to: Pos): Dir | null {
  for (const d of DIR_LIST) {
    const n = step(from, d);
    if (n.x === to.x && n.y === to.y) return d;
  }
  return null;
}

export const TERRAIN_FILL: Record<TerrainId, string> = {
  plains: '#46613f', barren: '#625a4b', forest: '#1f4d38', ice: '#7ba3b2', mountain: '#6b6b76',
  swamp: '#44513f', desert: '#92804a', lava: '#a0401f', volcano: '#7b2a18', water: '#2b5d8f', void: '#08090d',
};
