import { describe, expect, it } from 'vitest';
import { emptyOrders, type GameState, type Orders } from '@sanctum/engine';
import { afterReport, begin, lock, newSession, pickMana } from '../src/model/session';
import { addTrain, setMove } from '../src/model/drafts';

const redGroup = (s: GameState) => Object.values(s.groups).find((g) => g.owner === 'red')!;

describe('hotseat session', () => {
  it('starts on the hand-off screen for red', () => {
    const s = newSession(7, { red: 'war', blue: 'life' });
    expect(s.screen).toEqual({ kind: 'handoff', to: 'red' });
    expect(Object.values(s.state.players.red.hand)).toHaveLength(5);
  });

  it('walks a full turn: red locks, blue locks, the turn resolves and a report appears', () => {
    let s = newSession(7, { red: 'war', blue: 'war' });
    s = begin(s, 'red');
    expect(s.screen).toEqual({ kind: 'orders', side: 'red' });
    const move: Orders = setMove(emptyOrders(), redGroup(s.state).id, 'e');
    const r1 = lock(s, 'red', move);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    s = r1.session;
    expect(s.screen).toEqual({ kind: 'handoff', to: 'blue' });
    s = begin(s, 'blue');
    const r2 = lock(s, 'blue', emptyOrders());
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    s = r2.session;
    expect(s.screen.kind).toBe('report');
    expect(s.state.turn).toBe(2);
    expect(s.report?.sections.some((x) => x.title === 'Movement')).toBe(true);
    s = afterReport(s);
    expect(s.screen).toEqual({ kind: 'handoff', to: 'red' });
  });

  it('refuses illegal orders and leaves the session unchanged', () => {
    let s = newSession(7, { red: 'war', blue: 'war' });
    s = begin(s, 'red');
    const bad = addTrain(emptyOrders(), 999, 'swordsman');
    const r = lock(s, 'red', bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/cannot train/);
    expect(s.screen).toEqual({ kind: 'orders', side: 'red' });
  });

  it('asks the owner of a captured structure for a mana type', () => {
    let s = newSession(7, { red: 'war', blue: 'war' });
    const town = Object.values(s.state.structures).find((x) => x.kind === 'town')!;
    // park a red group on a neutral town so it is captured at the next start of turn
    const g = redGroup(s.state);
    g.pos = { ...town.pos };
    s = begin(s, 'red');
    let r = lock(s, 'red', emptyOrders());
    if (!r.ok) throw new Error(r.error);
    s = begin(r.session, 'blue');
    r = lock(s, 'blue', emptyOrders());
    if (!r.ok) throw new Error(r.error);
    s = afterReport(r.session);
    expect(s.screen).toEqual({ kind: 'mana', side: 'red' });
    s = pickMana(s, 'red', town.id, 'strife');
    expect(s.screen).toEqual({ kind: 'handoff', to: 'red' });
    expect(s.state.structures[town.id].manaType).toBe('strife');
  });
});
