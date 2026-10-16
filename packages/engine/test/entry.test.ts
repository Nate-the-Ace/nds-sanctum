import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { canEnterSquare, runMovement } from '../src/movement';
import { validateOrders } from '../src/orders';
import { addSpellRecord } from '../src/spellstore';
import { emptyOrders } from '../src/types';
import { blankEngine, put } from './helpers';

const wall = defineCard({
  id: 'wall', name: 'wall', house: 'life', cost: {}, type: 'conjuration', target: 'square',
  blocksEntry: (_q, sp, _gid, dest) => sp.host.kind === 'square' && sp.host.pos.x === dest.x && sp.host.pos.y === dest.y,
});
const everywhere = defineCard({ id: 'everywhere', name: 'everywhere', house: 'life', cost: {}, type: 'alteration', target: 'group', blocksEntry: () => true });

describe('blocksEntry', () => {
  it('stops movement into the square and is refused as an order', () => {
    const e = blankEngine([wall]);
    addSpellRecord(e.state, { cardId: 'wall', owner: 'blue', host: { kind: 'square', pos: { x: 5, y: 4 } }, visible: true, turnsLeft: null, tokens: {} });
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(canEnterSquare(e, g, { x: 5, y: 4 })).toBe(false);
    expect(canEnterSquare(e, g, { x: 4, y: 5 })).toBe(true);
    expect(validateOrders(e, 'red', { ...emptyOrders(), move: [{ groupId: g.id, dir: 'e' }] })).toBe('that square cannot be entered');
    g.moveOrder = 'e';
    runMovement(e);
    expect(g.pos).toEqual({ x: 4, y: 4 });
  });

  it('does nothing while its host is off the board', () => {
    const e = blankEngine([everywhere]);
    const away = put(e, 'blue', { x: 8, y: 2 }, ['swordsman']);
    addSpellRecord(e.state, { cardId: 'everywhere', owner: 'blue', host: { kind: 'group', id: away.id }, visible: true, turnsLeft: null, tokens: {} });
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(canEnterSquare(e, g, { x: 5, y: 4 })).toBe(false);
    away.pos = null;
    expect(canEnterSquare(e, g, { x: 5, y: 4 })).toBe(true);
  });
});
