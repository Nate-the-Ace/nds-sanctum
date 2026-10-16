import { describe, expect, it } from 'vitest';
import { SANCTUM_POS } from '@sanctum/engine';
import { dirBetween, project } from '../src/model/geometry';

describe('geometry', () => {
  it('projects the board onto a diamond with the Sancta at top and bottom', () => {
    const red = project(SANCTUM_POS.red);
    const blue = project(SANCTUM_POS.blue);
    expect(red.x).toBe(0);
    expect(blue.x).toBe(0);
    expect(red.y).toBeLessThan(blue.y);
    expect(project({ x: 5, y: 4 }).x).toBeGreaterThan(project({ x: 4, y: 5 }).x);
  });
  it('finds the direction between orthogonal neighbours', () => {
    expect(dirBetween({ x: 3, y: 3 }, { x: 4, y: 3 })).toBe('e');
    expect(dirBetween({ x: 3, y: 3 }, { x: 3, y: 2 })).toBe('n');
    expect(dirBetween({ x: 3, y: 3 }, { x: 4, y: 4 })).toBeNull();
  });
});
