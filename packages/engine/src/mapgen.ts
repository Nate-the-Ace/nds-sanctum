import type { Pos, TerrainId } from './types';
import { nextRandom, pick, type Seeded } from './rng';
import {
  BOARD_SIZE, createCells, entrances, isEdge, key, neighborPositions, onCenterline, parseKey, rotate, sanctumSquares, samePos,
} from './board';
import { HARSH } from './terrain';

const adjacent = (a: Pos, b: Pos) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

function eligible(p: Pos, placed: Pos[]): boolean {
  if (isEdge(p)) return false;
  const s = p.x + p.y;
  if (s >= BOARD_SIZE - 2 && s <= BOARD_SIZE + 0) return false; // centerline (9) and its two neighbours (8, 10)
  const entr = [...entrances('red'), ...entrances('blue')];
  if (entr.some((e) => adjacent(e, p) || samePos(e, p))) return false;
  if (sanctumSquares('red').concat(sanctumSquares('blue')).some((q) => samePos(q, p))) return false;
  if (placed.some((t) => adjacent(t, p) || samePos(t, p))) return false;
  return true;
}

/** Half the towns (rounded down) random on the red half, rotated onto the blue half; an odd town goes on a centre-line square. */
export function placeTowns(rng: Seeded, count: number): Pos[] {
  const half = Math.floor(count / 2);
  const redHalf = createCells().map(parseKey).filter((p) => p.x + p.y < BOARD_SIZE - 2);
  const first: Pos[] = [];
  for (let i = 0; i < half; i++) {
    const placed = [...first, ...first.map(rotate)];
    const options = redHalf.filter((p) => eligible(p, placed) && eligible(rotate(p), placed));
    first.push(pick(rng, options));
  }
  const result = [...first, ...first.map(rotate)];
  if (count % 2 === 1) result.push(pick(rng, [{ x: 4, y: 5 }, { x: 5, y: 4 }]));
  return result;
}

const VELDT: Array<[TerrainId, number]> = [
  ['plains', 57], ['forest', 19.5], ['water', 4], ['mountain', 2.5], ['desert', 0.5], ['swamp', 0.5],
];
const DEFAULT_TERRAIN: TerrainId = 'plains';

function roll(rng: Seeded): TerrainId {
  const total = VELDT.reduce((a, [, w]) => a + w, 0);
  let r = nextRandom(rng) * total;
  for (const [t, w] of VELDT) {
    if (r < w) return t;
    r -= w;
  }
  return DEFAULT_TERRAIN;
}

/** Roll half the squares, mirror the rest, then apply the structure/default/max-1 rules. */
export function rollTerrain(rng: Seeded, cells: string[], towns: Pos[]): Record<string, TerrainId> {
  const terrain: Record<string, TerrainId> = {};
  const cellSet = new Set(cells);
  for (const k of cells) {
    const p = parseKey(k);
    if (p.x + p.y < BOARD_SIZE - 1 || onCenterline(p)) {
      terrain[k] = roll(rng);
    }
  }
  for (const k of cells) {
    if (terrain[k] !== undefined) continue;
    const r = key(rotate(parseKey(k)));
    terrain[k] = terrain[r] ?? DEFAULT_TERRAIN;
  }
  // default terrain next to each entrance (distance 2 from a Sanctum)
  for (const side of ['red', 'blue'] as const) {
    const area = sanctumSquares(side);
    for (const e of entrances(side)) {
      for (const n of neighborPositions(e)) {
        if (!cellSet.has(key(n.pos)) || area.some((q) => samePos(q, n.pos))) continue;
        terrain[key(n.pos)] = DEFAULT_TERRAIN;
      }
    }
  }
  // plains under structures
  for (const p of [...sanctumSquares('red'), ...sanctumSquares('blue'), ...towns]) terrain[key(p)] = 'plains';
  // max one blocking/deadly neighbour per town
  for (const t of towns) {
    let seen = 0;
    for (const n of neighborPositions(t)) {
      const k = key(n.pos);
      if (!cellSet.has(k)) continue;
      if (HARSH.includes(terrain[k])) {
        seen++;
        if (seen > 1) terrain[k] = DEFAULT_TERRAIN;
      }
    }
  }
  return terrain;
}
