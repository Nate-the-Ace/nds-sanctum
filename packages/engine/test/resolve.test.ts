import { describe, it, expect } from 'vitest';
import { confirmOrders, submitOrders, type Result } from '../src/api';
import { defineCard } from '../src/cards';
import { SANCTUM_POS } from '../src/board';
import { removeGroup } from '../src/units';
import { emptyOrders, type GameState, type Orders } from '../src/types';
import { gameEngine, put } from './helpers';

const bolt = defineCard({
  id: 'bolt', name: 'Bolt', house: 'war', cost: { strife: 1 }, type: 'manifestation', target: 'recruit',
  onCast: (c, t) => { if (t.kind === 'minion') c.damage(t.id, 3); },
});
const shield = defineCard({
  id: 'shield', name: 'Shield', house: 'war', cost: { strife: 1 }, type: 'conjuration', target: 'recruitGroup', duration: { turns: 2 },
});

function must(r: Result): GameState {
  if (!r.ok) throw new Error(r.error);
  return r.state;
}
const orders = (o: Partial<Orders>): Orders => ({ ...emptyOrders(), ...o });

function setup(defs = [bolt, shield], deck = Array(10).fill('bolt') as string[]) {
  const e = gameEngine(defs, deck);
  const redSanctum = Object.values(e.state.structures).find((s) => s.owner === 'red')!;
  const redGroup = Object.values(e.state.groups).find((g) => g.owner === 'red')!;
  const blueGroup = Object.values(e.state.groups).find((g) => g.owner === 'blue')!;
  return { e, redSanctum, redGroup, blueGroup };
}

function playBoltTurn() {
  const { e, redSanctum, blueGroup } = setup();
  const target = blueGroup.minionIds[0];
  let s = must(
    submitOrders(e.state, e.cards, 'red', orders({
      train: [{ structureId: redSanctum.id, as: 'strife' }],
      cast: [{ handIndex: 0, target: { kind: 'minion', id: target } }],
    })),
  );
  s = must(confirmOrders(s, e.cards, 'red'));
  const mid = s;
  s = must(confirmOrders(s, e.cards, 'blue'));
  return { e, s, mid, target, redSanctum };
}

describe('resolveTurn', () => {
  it('does not resolve until both players confirm', () => {
    const { mid } = playBoltTurn();
    expect(mid.turn).toBe(1);
    expect(mid.players.red.confirmed).toBe(true);
  });

  it('trains mana, casts, discards, redraws and starts the next turn', () => {
    const { s, target, redSanctum } = playBoltTurn();
    expect(s.turn).toBe(2);
    expect(s.phase).toBe('orders');
    expect(s.minions[target].hp).toBe(4);
    expect(s.players.red.hand).toHaveLength(5);
    expect(s.players.red.discard).toEqual(['bolt']);
    expect(s.structures[redSanctum.id].novices).toBe(2);
    expect(s.players.red.confirmed).toBe(false);
  });

  it('trains recruits into the Sanctum group', () => {
    const { e, redSanctum, redGroup } = setup();
    let s = must(submitOrders(e.state, e.cards, 'red', orders({
      train: [{ structureId: redSanctum.id, as: 'swordsman' }, { structureId: redSanctum.id, as: 'archer' }],
    })));
    s = must(confirmOrders(s, e.cards, 'red'));
    s = must(confirmOrders(s, e.cards, 'blue'));
    expect(s.groups[redGroup.id].minionIds).toHaveLength(6);
    expect(s.structures[redSanctum.id].novices).toBe(1);
  });

  it('moves groups by order', () => {
    const { e, redGroup } = setup();
    let s = must(submitOrders(e.state, e.cards, 'red', orders({ move: [{ groupId: redGroup.id, dir: 'e' }] })));
    s = must(confirmOrders(s, e.cards, 'red'));
    s = must(confirmOrders(s, e.cards, 'blue'));
    expect(s.groups[redGroup.id].pos).toEqual({ x: 3, y: 2 });
  });

  it('expires a two-turn conjuration at the second end of turn', () => {
    const { e, redSanctum, redGroup } = setup([bolt, shield], Array(10).fill('shield'));
    let s = must(submitOrders(e.state, e.cards, 'red', orders({
      train: [{ structureId: redSanctum.id, as: 'strife' }],
      cast: [{ handIndex: 0, target: { kind: 'group', id: redGroup.id } }],
    })));
    s = must(confirmOrders(s, e.cards, 'red'));
    s = must(confirmOrders(s, e.cards, 'blue'));
    expect(s.spells).toHaveLength(1);
    expect(s.spells[0].turnsLeft).toBe(1);
    s = must(confirmOrders(s, e.cards, 'red'));
    s = must(confirmOrders(s, e.cards, 'blue'));
    expect(s.spells).toHaveLength(0);
  });

  it('ends the game when a Sanctum is occupied, then refuses further orders', () => {
    const { e } = setup();
    for (const g of Object.values(e.state.groups)) if (g.owner === 'red') removeGroup(e, g.id);
    put(e, 'blue', SANCTUM_POS.red, ['swordsman']);
    let s = must(confirmOrders(e.state, e.cards, 'red'));
    s = must(confirmOrders(s, e.cards, 'blue'));
    expect(s.winner).toBe('blue');
    expect(s.phase).toBe('over');
    expect(confirmOrders(s, e.cards, 'red').ok).toBe(false);
  });

  it('refuses double confirmation and edits after confirmation', () => {
    const { e } = setup();
    const s = must(confirmOrders(e.state, e.cards, 'red'));
    expect(confirmOrders(s, e.cards, 'red').ok).toBe(false);
    expect(submitOrders(s, e.cards, 'red', emptyOrders()).ok).toBe(false);
  });
});

describe('determinism and serialization', () => {
  it('runs the same script to byte-identical JSON', () => {
    const a = playBoltTurn().s;
    const b = playBoltTurn().s;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('survives a JSON round trip', () => {
    const { s } = playBoltTurn();
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
