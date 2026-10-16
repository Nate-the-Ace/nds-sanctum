import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { dispatch } from '../src/events';
import { addSpellRecord, removeSpellRecord } from '../src/spellstore';
import type { PlayerId, Ref } from '../src/types';
import { blankEngine, put } from './helpers';

const logger = (id: string, order: string[], event: 'attack:hit' | 'turn:start') =>
  defineCard({
    id, name: id, house: 'war', cost: {}, type: 'alteration', target: 'globe',
    on: { [event]: () => { order.push(id); } },
  });

const host = (e: ReturnType<typeof blankEngine>, cardId: string, owner: PlayerId, h: Ref) =>
  addSpellRecord(e.state, { cardId, owner, host: h, visible: true, turnsLeft: null, tokens: {} });

describe('event bubbling', () => {
  it('goes minion -> group -> square -> structure -> globe', () => {
    const order: string[] = [];
    const e = blankEngine(['m', 'g', 'sq', 'st', 'gl'].map((id) => logger(id, order, 'attack:hit')));
    const grp = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    e.state.structures[900] = {
      id: 900, kind: 'town', pos: { x: 4, y: 4 }, owner: 'neutral', manaType: null, novices: 0, turnCount: 2, captured: false,
    };
    host(e, 'gl', 'red', { kind: 'globe' });
    host(e, 'st', 'red', { kind: 'structure', id: 900 });
    host(e, 'sq', 'red', { kind: 'square', pos: { x: 4, y: 4 } });
    host(e, 'g', 'red', { kind: 'group', id: grp.id });
    host(e, 'm', 'red', { kind: 'minion', id: grp.minionIds[0] });
    dispatch(e, 'attack:hit', { kind: 'minion', id: grp.minionIds[0] });
    expect(order).toEqual(['m', 'g', 'sq', 'st', 'gl']);
  });

  it('group events visit each minion, then the group, then the square', () => {
    const order: string[] = [];
    const e = blankEngine(['m1', 'm2', 'g', 'sq'].map((id) => logger(id, order, 'attack:hit')));
    const grp = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    host(e, 'sq', 'red', { kind: 'square', pos: { x: 4, y: 4 } });
    host(e, 'g', 'red', { kind: 'group', id: grp.id });
    host(e, 'm2', 'red', { kind: 'minion', id: grp.minionIds[1] });
    host(e, 'm1', 'red', { kind: 'minion', id: grp.minionIds[0] });
    dispatch(e, 'attack:hit', { kind: 'group', id: grp.id });
    expect(order).toEqual(['m1', 'm2', 'g', 'sq']);
  });

  it('untargeted events follow initiative order', () => {
    const order: string[] = [];
    const e = blankEngine(['n', 'b', 'r'].map((id) => logger(id, order, 'turn:start')));
    host(e, 'n', 'neutral', { kind: 'globe' });
    host(e, 'b', 'blue', { kind: 'globe' });
    host(e, 'r', 'red', { kind: 'globe' });
    e.state.initiative = 'red';
    dispatch(e, 'turn:start');
    expect(order).toEqual(['r', 'b', 'n']);
    order.length = 0;
    e.state.initiative = 'blue';
    dispatch(e, 'turn:start');
    expect(order).toEqual(['b', 'r', 'n']);
  });

  it('lets a handler cancel the event', () => {
    const cancel = defineCard({
      id: 'c', name: 'c', house: 'war', cost: {}, type: 'alteration', target: 'globe',
      on: { 'attack:hit': (c) => c.cancel() },
    });
    const e = blankEngine([cancel]);
    host(e, 'c', 'red', { kind: 'globe' });
    expect(dispatch(e, 'attack:hit', { kind: 'globe' }).data.cancel).toBe(true);
  });

  it('skips a spell removed by an earlier handler', () => {
    const order: string[] = [];
    let victimId = -1;
    const killer = defineCard({
      id: 'k', name: 'k', house: 'war', cost: {}, type: 'alteration', target: 'globe',
      on: { 'turn:start': (c) => { order.push('k'); removeSpellRecord(c.state as never, victimId); } },
    });
    const victim = logger('v', order, 'turn:start');
    const e = blankEngine([killer, victim]);
    host(e, 'k', 'red', { kind: 'globe' });
    victimId = host(e, 'v', 'red', { kind: 'globe' }).id;
    dispatch(e, 'turn:start');
    expect(order).toEqual(['k']);
  });
});
