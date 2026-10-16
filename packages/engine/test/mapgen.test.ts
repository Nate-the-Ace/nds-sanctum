import { describe, it, expect } from 'vitest';
import { placeTowns, rollTerrain } from '../src/mapgen';
import { terrainBlocks } from '../src/terrain';
import { createCells, entrances, isEdge, key, neighborPositions, onCenterline, rotate, sanctumSquares, samePos } from '../src/board';
import type { Pos } from '../src/types';

const adjacent = (a: Pos, b: Pos) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

describe('terrainBlocks', () => {
  it('follows the walk table', () => {
    expect(terrainBlocks('mountain', [])).toBe(true);
    expect(terrainBlocks('mountain', ['mountain'])).toBe(false);
    expect(terrainBlocks('volcano', ['fire'])).toBe(true);
    expect(terrainBlocks('volcano', ['mountain'])).toBe(false);
    expect(terrainBlocks('water', [])).toBe(true);
    expect(terrainBlocks('water', ['water'])).toBe(false);
    expect(terrainBlocks('water', ['flight'])).toBe(false);
    expect(terrainBlocks('plains', [])).toBe(false);
    expect(terrainBlocks('forest', [])).toBe(false);
  });
});

describe('placeTowns', () => {
  it('places 5 legal towns for many seeds', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const towns = placeTowns({ seed }, 5);
      expect(towns).toHaveLength(5);
      const entr = [...entrances('red'), ...entrances('blue')];
      const odd = towns[4];
      expect(onCenterline(odd)).toBe(true);
      for (const t of towns.slice(0, 4)) {
        expect(isEdge(t)).toBe(false);
        expect([8, 9, 10]).not.toContain(t.x + t.y);
      }
      for (const t of towns) {
        for (const e of entr) expect(adjacent(t, e)).toBe(false);
      }
      for (let i = 0; i < towns.length; i++) {
        for (let j = i + 1; j < towns.length; j++) expect(adjacent(towns[i], towns[j])).toBe(false);
      }
      for (let i = 0; i < 2; i++) expect(samePos(rotate(towns[i]), towns[i + 2])).toBe(true);
    }
  });

  it('is deterministic', () => {
    expect(placeTowns({ seed: 3 }, 5)).toEqual(placeTowns({ seed: 3 }, 5));
  });

  it('places a single town on the centerline', () => {
    const t = placeTowns({ seed: 11 }, 1);
    expect(t).toHaveLength(1);
    expect(onCenterline(t[0])).toBe(true);
  });
});

describe('rollTerrain', () => {
  it('forces plains on structures and keeps towns open', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = { seed };
      const towns = placeTowns(rng, 5);
      const terrain = rollTerrain(rng, createCells(), towns);
      for (const s of [...sanctumSquares('red'), ...sanctumSquares('blue'), ...towns]) {
        expect(terrain[key(s)]).toBe('plains');
      }
      const blocking = ['mountain', 'volcano', 'swamp', 'water', 'void'];
      for (const t of towns) {
        const n = neighborPositions(t).filter((q) => blocking.includes(terrain[key(q.pos)] ?? 'plains')).length;
        expect(n).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is deterministic and covers every cell', () => {
    const cells = createCells();
    const a = rollTerrain({ seed: 4 }, cells, []);
    const b = rollTerrain({ seed: 4 }, cells, []);
    expect(a).toEqual(b);
    expect(Object.keys(a).sort()).toEqual([...cells].sort());
  });
});
