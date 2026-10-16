import type { BaseStats, HouseId, Nation, Walk } from './types';

export interface NationDef {
  house: HouseId;
  hp: 7 | 9;
  walks: Walk[];
  /** +1 damage: hand attacks in round 2, or missile attacks in round 1. */
  combat: 'hand2' | 'missile1' | null;
}

/** From `research/rules/Axioms_houses.txt`. */
export const NATIONS: Record<Nation, NationDef> = {
  imp: { house: 'abomination', hp: 7, walks: [], combat: 'hand2' },
  cyclops: { house: 'body', hp: 9, walks: [], combat: null },
  keeper: { house: 'death', hp: 7, walks: [], combat: 'hand2' },
  shadow: { house: 'despair', hp: 7, walks: ['mountain'], combat: null },
  vision: { house: 'hope', hp: 7, walks: ['water'], combat: null },
  gargoyle: { house: 'justice', hp: 9, walks: [], combat: null },
  elf: { house: 'life', hp: 7, walks: [], combat: 'missile1' },
  dwarf: { house: 'making', hp: 7, walks: ['mountain'], combat: null },
  djinn: { house: 'mind', hp: 7, walks: ['water'], combat: null },
  satyr: { house: 'nature', hp: 7, walks: [], combat: 'missile1' },
  misfit: { house: 'unmaking', hp: 9, walks: [], combat: null },
  human: { house: 'war', hp: 7, walks: [], combat: 'hand2' },
};
export const NATION_LIST = Object.keys(NATIONS) as Nation[];

export const nationOfHouse = (house: HouseId): Nation => NATION_LIST.find((n) => NATIONS[n].house === house)!;

export function applyNation(base: BaseStats, nation: Nation): BaseStats {
  return { ...base, hp: NATIONS[nation].hp, walks: [...base.walks, ...NATIONS[nation].walks] };
}
