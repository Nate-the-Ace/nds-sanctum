/**
 * Internals for tests of code built on the engine (card scripts). Not part of the public API:
 * import as `@sanctum/engine/src/testing`.
 */
export { makeEngine } from './engine';
export type { Engine } from './engine';
export { blankState } from './state';
export { indexCards } from './cards';
export { executeCast, recheck, castCheck, targetLegal } from './spells';
export { createGroup, spawnMinion, recruitSpec, addRecruit } from './units';
export { computeStats } from './stats';
export { beginTurn } from './turn';
export { runMovement, canEnterSquare, entryBlocked } from './movement';
export { runCombats, fight } from './combat';
export { dispatch } from './events';
export { addSpellRecord } from './spellstore';
export { takeDamage, applyDamage } from './damage';
export { killMinion } from './death';
export { expireSpells, dispel } from './spells';
