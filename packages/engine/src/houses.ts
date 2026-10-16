import type { HouseId, Mana } from './types';

/** From Axioms/houses: each house has a primary and secondary mana type. */
export const HOUSES: Record<HouseId, { primary: Mana; secondary: Mana }> = {
  justice: { primary: 'order', secondary: 'mystery' },
  making: { primary: 'order', secondary: 'will' },
  hope: { primary: 'clarity', secondary: 'order' },
  life: { primary: 'clarity', secondary: 'world' },
  body: { primary: 'world', secondary: 'mystery' },
  nature: { primary: 'world', secondary: 'order' },
  unmaking: { primary: 'strife', secondary: 'world' },
  war: { primary: 'strife', secondary: 'clarity' },
  death: { primary: 'mystery', secondary: 'will' },
  despair: { primary: 'mystery', secondary: 'strife' },
  mind: { primary: 'will', secondary: 'clarity' },
  abomination: { primary: 'will', secondary: 'strife' },
};

export function houseMana(h: HouseId): Mana[] {
  return [HOUSES[h].primary, HOUSES[h].secondary];
}
