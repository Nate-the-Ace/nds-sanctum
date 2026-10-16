import { describe, it, expect } from 'vitest';
import { addRecruit, removeGroup } from '../src/units';
import { blankEngine, put } from './helpers';

describe('units', () => {
  it('addRecruit joins a friendly group in the square', () => {
    const e = blankEngine();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const m = addRecruit(e, 'red', { x: 4, y: 4 }, 'archer');
    expect(m.groupId).toBe(g.id);
    expect(e.state.groups[g.id].minionIds).toHaveLength(2);
  });

  it('addRecruit starts a new group in an empty square and registers it in the group sequence', () => {
    const e = blankEngine();
    const m = addRecruit(e, 'blue', { x: 5, y: 5 }, 'swordsman');
    expect(e.state.groups[m.groupId].owner).toBe('blue');
    expect(e.state.groupSeq.blue).toContain(m.groupId);
  });

  it('addRecruit starts a new group when the existing one is full', () => {
    const e = blankEngine();
    const g = put(e, 'red', { x: 4, y: 4 }, Array(8).fill('swordsman'));
    const m = addRecruit(e, 'red', { x: 4, y: 4 }, 'archer');
    expect(m.groupId).not.toBe(g.id);
  });

  it('removeGroup clears the sequence entry', () => {
    const e = blankEngine();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    removeGroup(e, g.id);
    expect(e.state.groups[g.id]).toBeUndefined();
    expect(e.state.groupSeq.red).not.toContain(g.id);
  });
});
