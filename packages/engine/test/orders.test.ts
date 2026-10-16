import { describe, it, expect } from 'vitest';
import { submitOrders } from '../src/api';
import { defineCard } from '../src/cards';
import { SANCTUM_POS } from '../src/board';
import { validateOrders } from '../src/orders';
import { emptyOrders, type Orders } from '../src/types';
import { gameEngine, put } from './helpers';

const bolt = defineCard({
  id: 'bolt', name: 'Bolt', house: 'war', cost: { strife: 1 }, type: 'manifestation', target: 'recruit',
});
const deck = Array(10).fill('bolt');

function setup() {
  const e = gameEngine([bolt], deck);
  const sanctum = Object.values(e.state.structures).find((s) => s.owner === 'red')!;
  const blue = Object.values(e.state.groups).find((g) => g.owner === 'blue')!;
  return { e, sanctum, blueMinion: blue.minionIds[0] };
}
const orders = (o: Partial<Orders>): Orders => ({ ...emptyOrders(), ...o });

describe('validateOrders: training', () => {
  it('accepts empty orders and mana training in the house', () => {
    const { e, sanctum } = setup();
    expect(validateOrders(e, 'red', emptyOrders())).toBeNull();
    expect(validateOrders(e, 'red', orders({ train: [{ structureId: sanctum.id, as: 'strife' }] }))).toBeNull();
    expect(validateOrders(e, 'red', orders({ train: [{ structureId: sanctum.id, as: 'clarity' }] }))).toBeNull();
  });

  it('rejects mana outside the house, a second mana novice, and over-training', () => {
    const { e, sanctum } = setup();
    expect(validateOrders(e, 'red', orders({ train: [{ structureId: sanctum.id, as: 'mystery' }] }))).toMatch(/house/);
    expect(
      validateOrders(e, 'red', orders({ train: [{ structureId: sanctum.id, as: 'strife' }, { structureId: sanctum.id, as: 'clarity' }] })),
    ).toMatch(/one novice/);
    const four = Array(4).fill({ structureId: sanctum.id, as: 'swordsman' });
    expect(validateOrders(e, 'red', orders({ train: four }))).toMatch(/novices/);
  });

  it('rejects training at an enemy structure and group overflow', () => {
    const { e, sanctum } = setup();
    const blueSanctum = Object.values(e.state.structures).find((s) => s.owner === 'blue')!;
    expect(validateOrders(e, 'red', orders({ train: [{ structureId: blueSanctum.id, as: 'archer' }] }))).toMatch(/cannot train/);
    sanctum.novices = 8;
    const five = Array(5).fill({ structureId: sanctum.id, as: 'archer' });
    expect(validateOrders(e, 'red', orders({ train: five }))).toMatch(/8/);
  });

  it('rejects training where an enemy group stands', () => {
    const { e, sanctum } = setup();
    for (const g of Object.values(e.state.groups)) if (g.owner === 'red') g.owner = 'blue';
    expect(validateOrders(e, 'red', orders({ train: [{ structureId: sanctum.id, as: 'archer' }] }))).toMatch(/occupied/);
  });
});

describe('validateOrders: casting', () => {
  it('needs mana, which a mana novice provides', () => {
    const { e, sanctum, blueMinion } = setup();
    const cast = { handIndex: 0, target: { kind: 'minion' as const, id: blueMinion } };
    expect(validateOrders(e, 'red', orders({ cast: [cast] }))).toMatch(/strife/);
    expect(validateOrders(e, 'red', orders({ train: [{ structureId: sanctum.id, as: 'strife' }], cast: [cast] }))).toBeNull();
    const two = [cast, { handIndex: 1, target: cast.target }];
    expect(validateOrders(e, 'red', orders({ train: [{ structureId: sanctum.id, as: 'strife' }], cast: two }))).toMatch(/strife/);
  });

  it('rejects bad targets, repeated or unknown hand indexes', () => {
    const { e, sanctum, blueMinion } = setup();
    const train = [{ structureId: sanctum.id, as: 'strife' as const }];
    expect(validateOrders(e, 'red', orders({ train, cast: [{ handIndex: 0, target: { kind: 'globe' } }] }))).toMatch(/cannot target/);
    const ok = { handIndex: 0, target: { kind: 'minion' as const, id: blueMinion } };
    expect(validateOrders(e, 'red', orders({ train, cast: [ok, ok] }))).toMatch(/hand index/);
    expect(validateOrders(e, 'red', orders({ train, cast: [{ ...ok, handIndex: 9 }] }))).toMatch(/hand index/);
  });

  it('validates discard', () => {
    const { e, sanctum, blueMinion } = setup();
    expect(validateOrders(e, 'red', orders({ discard: 2 }))).toBeNull();
    expect(validateOrders(e, 'red', orders({ discard: 9 }))).toMatch(/discard/);
    const train = [{ structureId: sanctum.id, as: 'strife' as const }];
    const cast = [{ handIndex: 0, target: { kind: 'minion' as const, id: blueMinion } }];
    expect(validateOrders(e, 'red', orders({ train, cast, discard: 0 }))).toMatch(/casting/);
  });
});

describe('validateOrders: movement', () => {
  it('accepts a legal move and rejects illegal ones', () => {
    const { e } = setup();
    const red = Object.values(e.state.groups).find((g) => g.owner === 'red')!;
    expect(validateOrders(e, 'red', orders({ move: [{ groupId: red.id, dir: 'e' }] }))).toBeNull();
    expect(validateOrders(e, 'red', orders({ move: [{ groupId: red.id, dir: 'e' }, { groupId: red.id, dir: 's' }] }))).toMatch(/one move/);
    const blue = Object.values(e.state.groups).find((g) => g.owner === 'blue')!;
    expect(validateOrders(e, 'red', orders({ move: [{ groupId: blue.id, dir: 'w' }] }))).toMatch(/move/);
    const edge = put(e, 'red', { x: 0, y: 5 }, ['swordsman']);
    expect(validateOrders(e, 'red', orders({ move: [{ groupId: edge.id, dir: 'w' }] }))).toMatch(/board/);
    e.state.terrain[`${SANCTUM_POS.red.x + 1},${SANCTUM_POS.red.y}`] = 'water';
    expect(validateOrders(e, 'red', orders({ move: [{ groupId: red.id, dir: 'e' }] }))).toMatch(/terrain/);
  });

  it('refuses computer-controlled groups', () => {
    const { e } = setup();
    const bot = put(e, 'red', { x: 5, y: 5 }, ['swordsman'], 'computer');
    expect(validateOrders(e, 'red', orders({ move: [{ groupId: bot.id, dir: 'e' }] }))).toMatch(/move/);
  });
});

describe('submitOrders', () => {
  it('stores valid orders, replaces earlier ones, and reports errors', () => {
    const { e, sanctum } = setup();
    const r1 = submitOrders(e.state, e.cards, 'red', orders({ train: [{ structureId: sanctum.id, as: 'strife' }] }));
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.state.players.red.orders?.train).toHaveLength(1);
    const r2 = submitOrders(r1.state, e.cards, 'red', emptyOrders());
    expect(r2.ok && r2.state.players.red.orders?.train).toHaveLength(0);
    const bad = submitOrders(e.state, e.cards, 'red', orders({ discard: 99 }));
    expect(bad.ok).toBe(false);
  });
});
