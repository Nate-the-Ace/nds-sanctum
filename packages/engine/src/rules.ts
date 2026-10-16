import type { BaseStats } from './types';

export const RULES = {
  handSize: 5,
  maxGroup: 8,
  maxNovices: 8,
  sanctumNoviceRate: 4,
  townNoviceRate: 2,
  startNovices: 3,
  startGroup: ['swordsman', 'swordsman', 'archer', 'archer'] as const,
  minDeck: 30,
  maxCopies: 4,
  recruitHp: 7,
  recruitLevel: 1,
  combatRounds: 10,
  maxLevel: 5,
  towns: 5,
} as const;

export function recruitBase(cls: 'swordsman' | 'archer'): BaseStats {
  return cls === 'swordsman'
    ? { hp: RULES.recruitHp, level: RULES.recruitLevel, armor: 1, hand: 2, handAttacks: 1, missile: 0, missileAttacks: 0, walks: [] }
    : { hp: RULES.recruitHp, level: RULES.recruitLevel, armor: 0, hand: 0, handAttacks: 0, missile: 2, missileAttacks: 1, walks: [] };
}
