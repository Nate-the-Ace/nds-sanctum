import type { TerrainId, Walk } from './types';

/** True if a group whose members all have `walks` cannot enter or exit this terrain. */
export function terrainBlocks(t: TerrainId, walks: Walk[]): boolean {
  if (walks.includes('flight')) return false;
  switch (t) {
    case 'mountain':
    case 'volcano':
      return !walks.includes('mountain');
    case 'water':
      return !walks.includes('water');
    default:
      return false;
  }
}

/**
 * True if a minion with `walks` cannot be placed on this terrain: it could never leave it (it blocks) or it would be
 * removed at once (void). Water already blocks a minion that would drown in it.
 */
export function terrainForbids(t: TerrainId, walks: Walk[]): boolean {
  return terrainBlocks(t, walks) || (t === 'void' && !walks.includes('flight'));
}

/** Terrains that block movement or are deadly (the "max 1 per town" map rule). */
export const HARSH: TerrainId[] = ['mountain', 'volcano', 'swamp', 'water', 'void'];

/** Damage dealt after start of turn, and the walk that prevents it. */
export const TERRAIN_DAMAGE: Partial<Record<TerrainId, { damage: number; immune: Walk }>> = {
  desert: { damage: 1, immune: 'desert' },
  lava: { damage: 3, immune: 'fire' },
  volcano: { damage: 5, immune: 'fire' },
};
