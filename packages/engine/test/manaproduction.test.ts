import { describe, it, expect } from 'vitest';
import { confirmOrders, submitOrders, type Result } from '../src/api';
import { validateOrders } from '../src/orders';
import { defineCard } from '../src/cards';
import { emptyOrders, type GameState, type Orders } from '../src/types';
import { gameEngine } from './helpers';

const zap = defineCard({ id: 'zap', name: 'Zap', house: 'war', cost: { strife: 1 }, type: 'manifestation', target: 'globe' });

function must(r: Result): GameState {
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** Plays one turn: red submits `red` orders, both confirm. */
function playTurn(s: GameState, cards: Parameters<typeof submitOrders>[1], red: Partial<Orders> = {}): GameState {
  s = must(submitOrders(s, cards, 'red', { ...emptyOrders(), ...red }));
  s = must(confirmOrders(s, cards, 'red'));
  return must(confirmOrders(s, cards, 'blue'));
}

describe('Sanctum mana production (rules: Axioms_manatypes "Generating Mana")', () => {
  it('a mana novice generates every turn after it is trained, and the pool does not accumulate', () => {
    const e = gameEngine([zap], Array(10).fill('zap'));
    const sanctumId = Object.values(e.state.structures).find((x) => x.kind === 'sanctum' && x.owner === 'red')!.id;
    const train = [{ structureId: sanctumId, as: 'strife' as const }];
    let s = e.state;
    expect(s.players.red.mana.strife).toBe(0);

    s = playTurn(s, e.cards, { train }); // turn 1: trains #1 (credit only)
    expect(s.turn).toBe(2);
    expect(s.players.red.mana.strife).toBe(1);
    expect(s.structures[sanctumId].manaTrained?.strife).toBe(1);

    s = playTurn(s, e.cards, { train }); // turn 2: trains #2, spends nothing
    expect(s.turn).toBe(3);
    expect(s.players.red.mana.strife).toBe(2);

    s = playTurn(s, e.cards, { train }); // turn 3: trains #3
    expect(s.turn).toBe(4);
    expect(s.players.red.mana.strife).toBe(3); // not 1+2+3: unused mana is lost
    expect(s.players.blue.mana.strife).toBe(0);
  });

  it('credits the novice in its training turn on top of existing production, once', () => {
    const e = gameEngine([zap], Array(10).fill('zap'));
    const sanctumId = Object.values(e.state.structures).find((x) => x.kind === 'sanctum' && x.owner === 'red')!.id;
    const train = [{ structureId: sanctumId, as: 'strife' as const }];
    const s = playTurn(e.state, e.cards, { train });
    // turn 2: production 1 + credit for a second novice = 2 castable, 3 is not
    e.state = s;
    const two = Array(2).fill(0).map((_, i) => ({ handIndex: i, target: { kind: 'globe' as const } }));
    const three = Array(3).fill(0).map((_, i) => ({ handIndex: i, target: { kind: 'globe' as const } }));
    expect(validateOrders(e, 'red', { ...emptyOrders(), cast: two })).toMatch(/strife/);
    expect(validateOrders(e, 'red', { ...emptyOrders(), train, cast: two })).toBeNull();
    expect(validateOrders(e, 'red', { ...emptyOrders(), train, cast: three })).toMatch(/strife/);
  });
});
