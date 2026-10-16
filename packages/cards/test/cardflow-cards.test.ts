import { describe, expect, it } from 'vitest';
import { validateDeck } from '@sanctum/engine';
import type { Ref } from '@sanctum/engine';
import { computeStats, dispatch, killMinion } from '@sanctum/engine/src/testing';
import { allCards, cardIndex, playableCards, starterDeck } from '../src/index';
import { advance, castMini, mini, put } from './lang-helpers';

const mref = (id: number): Ref => ({ kind: 'minion', id });
const globe: Ref = { kind: 'globe' };
const town = (id: number, owner: 'red' | 'blue' | 'neutral', x: number, y: number) =>
  ({ id, kind: 'town' as const, pos: { x, y }, owner, manaType: null, novices: 0, turnCount: 2, captured: false });

describe('Recursive cards', () => {
  it('Growing Strife: +T H and a copy with one more token in hand', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman']);
    expect(castMini(e, 'red', 'growing-strife', mref(g.minionIds[0]))).toBe('cast');
    expect(computeStats(e, g.minionIds[0]).hand).toBe(3);
    expect(e.state.players.red.hand).toEqual(['growing-strife-2']);
    expect(castMini(e, 'red', 'growing-strife-2', mref(g.minionIds[1]))).toBe('cast');
    expect(computeStats(e, g.minionIds[1]).hand).toBe(4);
    expect(e.state.players.red.hand).toEqual(['growing-strife-2', 'growing-strife-3']);
    expect(castMini(e, 'red', 'growing-strife-3', mref(g.minionIds[0]))).toBe('squandered'); // same spell already there
  });

  it('copies cost more, carry the token count in their name, stop at 8 and stay out of decks', () => {
    expect(cardIndex['growing-strife'].cost).toEqual({ strife: 2 });
    expect(cardIndex['growing-strife-2']).toMatchObject({ name: 'Growing Strife (2 tokens)', cost: { strife: 3 }, copyOf: 'growing-strife' });
    expect(cardIndex['greater-clarity-8'].cost).toEqual({ clarity: 9 });
    expect(cardIndex['growing-strife-9']).toBeUndefined();
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    castMini(e, 'red', 'growing-strife-8', mref(g.minionIds[0]));
    expect(e.state.players.red.hand).toEqual(['growing-strife-8']);
    expect(playableCards.some((c) => c.copyOf)).toBe(false);
    expect(starterDeck('war').cards.some((id) => id.startsWith('growing-strife-'))).toBe(false);
    expect(validateDeck({ house: 'war', cards: Array(30).fill('growing-strife-2') }, cardIndex)).toMatch(/hand copy/);
  });

  it('Greater Clarity: +T M', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    castMini(e, 'red', 'greater-clarity', mref(g.minionIds[0]));
    expect(computeStats(e, g.minionIds[0]).missile).toBe(3);
    expect(e.state.players.red.hand).toEqual(['greater-clarity-2']);
  });
});

describe('Book of War', () => {
  it('a recruit that kills gets one level at the next start of turn', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman']);
    expect(castMini(e, 'red', 'book-of-war', globe)).toBe('cast');
    dispatch(e, 'attacker:kills', mref(g.minionIds[0]), { victimId: 0 });
    dispatch(e, 'attacker:kills', mref(g.minionIds[0]), { victimId: 0 });
    expect(e.state.minions[g.minionIds[0]].base.level).toBe(1);
    advance(e);
    expect(e.state.minions[g.minionIds[0]].base.level).toBe(2);
    expect(e.state.minions[g.minionIds[1]].base.level).toBe(1);
    advance(e);
    expect(e.state.minions[g.minionIds[0]].base.level).toBe(2);
  });
});

describe('Day of Mourning', () => {
  it('each recruit death removes the top card of its owner\'s deck, for 5 turns', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman']);
    e.state.players.red.deck = ['a', 'b', 'c'];
    expect(castMini(e, 'blue', 'day-of-mourning', globe)).toBe('cast');
    expect(e.state.spells.find((s) => s.cardId === 'day-of-mourning')!.turnsLeft).toBe(5);
    killMinion(e, g.minionIds[0], null, 'dies');
    expect(e.state.players.red.deck).toEqual(['b', 'c']);
    killMinion(e, g.minionIds[1], null, 'removed'); // removed from the game: not a death
    expect(e.state.players.red.deck).toEqual(['b', 'c']);
  });
});

describe('Seelie Champion', () => {
  it('+1 M for each alteration cast on the archer after it', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    const a = g.minionIds[0];
    expect(castMini(e, 'red', 'seelie-champion', mref(a))).toBe('cast');
    expect(computeStats(e, a).missile).toBe(2);
    castMini(e, 'red', 'marksman', mref(a)); // +1 M itself, +1 from the Champion
    expect(computeStats(e, a).missile).toBe(4);
    castMini(e, 'red', 'cadre', { kind: 'group', id: g.id }); // a group spell does not count
    expect(computeStats(e, a).missile).toBe(4);
    castMini(e, 'blue', 'greater-clarity', mref(a)); // anyone's alteration counts
    expect(computeStats(e, a).missile).toBe(6);
  });
});

describe('Spy at Court', () => {
  it('tells its caster the top card of the owner\'s deck at start of turn, before draws', () => {
    const e = mini(allCards);
    e.state.structures[900] = town(900, 'blue', 4, 4);
    e.state.players.blue.deck = ['fireball', 'pyx'];
    expect(castMini(e, 'red', 'spy-at-court', { kind: 'structure', id: 900 })).toBe('cast');
    advance(e);
    expect(e.state.players.red.intel).toEqual([{ source: 'spy-at-court', side: 'blue', cardId: 'fireball' }]);
    expect(e.state.players.blue.hand).toContain('fireball');
  });
  it('learns nothing from a neutral town', () => {
    const e = mini(allCards);
    e.state.structures[900] = town(900, 'neutral', 4, 4);
    castMini(e, 'red', 'spy-at-court', { kind: 'structure', id: 900 });
    advance(e);
    expect(e.state.players.red.intel).toBeUndefined();
  });
});

describe('Challenge', () => {
  it('gives Initiative to the owner of the highest-level recruit on the board', () => {
    const e = mini(allCards);
    const red = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const blue = put(e, 'blue', { x: 6, y: 6 }, ['swordsman']);
    e.state.initiative = 'blue';
    e.state.minions[red.minionIds[0]].base.level = 3;
    castMini(e, 'blue', 'challenge', globe);
    expect(e.state.initiative).toBe('red');
    e.state.minions[blue.minionIds[0]].base.level = 3;
    e.state.initiative = 'blue';
    castMini(e, 'red', 'challenge', globe);
    expect(e.state.initiative).toBe('blue'); // tie: no change
  });
  it('ignores recruits off the board', () => {
    const e = mini(allCards);
    const red = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    put(e, 'blue', { x: 6, y: 6 }, ['swordsman']);
    e.state.minions[red.minionIds[0]].base.level = 4;
    e.state.groups[red.id].pos = null;
    castMini(e, 'red', 'challenge', globe);
    expect(e.state.initiative).toBe('blue');
  });
});
