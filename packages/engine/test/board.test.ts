import { describe, it, expect } from 'vitest';
import { createCells, sanctumSquares, entrances, step, key, distance2, onCenterline, rotate, isEdge } from '../src/board';

describe('board', () => {
  const cells = new Set(createCells());

  it('has 94 unique squares', () => {
    expect(cells.size).toBe(94);
    expect(cells.has('0,0')).toBe(false);
    expect(cells.has('1,0')).toBe(false);
    expect(cells.has('0,1')).toBe(false);
    expect(cells.has('9,9')).toBe(false);
    expect(cells.has('1,1')).toBe(true);
  });

  it('is symmetric under 180 degree rotation', () => {
    for (const k of cells) {
      const [x, y] = k.split(',').map(Number);
      expect(cells.has(key(rotate({ x, y })))).toBe(true);
    }
  });

  it('builds sanctum plus shapes', () => {
    const red = sanctumSquares('red').map(key).sort();
    expect(red).toEqual(['1,2', '2,1', '2,2', '2,3', '3,2']);
    expect(entrances('red').map(key).sort()).toEqual(['1,2', '2,1', '2,3', '3,2']);
    expect(sanctumSquares('blue').map(key).sort()).toEqual(['6,7', '7,6', '7,7', '7,8', '8,7']);
  });

  it('steps in four directions', () => {
    expect(step({ x: 4, y: 4 }, 'n')).toEqual({ x: 4, y: 3 });
    expect(step({ x: 4, y: 4 }, 'e')).toEqual({ x: 5, y: 4 });
    expect(step({ x: 4, y: 4 }, 's')).toEqual({ x: 4, y: 5 });
    expect(step({ x: 4, y: 4 }, 'w')).toEqual({ x: 3, y: 4 });
  });

  it('measures distance and centerline', () => {
    expect(distance2({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25);
    expect(onCenterline({ x: 4, y: 5 })).toBe(true);
    expect(onCenterline({ x: 4, y: 4 })).toBe(false);
    expect(isEdge({ x: 0, y: 5 })).toBe(true);
    expect(isEdge({ x: 5, y: 5 })).toBe(false);
  });
});
