import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cardIndex } from '@sanctum/cards';
import { emptyOrders, type GameState } from '@sanctum/engine';
import { App } from '../src/app';
import { isSafePoint, loadSession, saveSession, type SaveStore } from '../src/model/persist';
import { afterReport, lock, newSession, pickMana } from '../src/model/session';

const groupOf = (s: GameState, side: 'red' | 'blue') => Object.values(s.groups).find((g) => g.owner === side)!;

function memory(): SaveStore {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

describe('vs computer session', () => {
  it('starts on blue orders with red already locked by the computer', () => {
    const s = newSession(7, { red: 'war', blue: 'life' }, cardIndex, 'vsNpc');
    expect(s.mode).toBe('vsNpc');
    expect(s.screen).toEqual({ kind: 'orders', side: 'blue' });
    expect(s.state.players.red.confirmed).toBe(true);
    expect(s.state.players.red.orders?.train.length).toBeGreaterThan(0);
  });

  it('resolves on blue lock, then goes straight to blue orders (no hand-off)', () => {
    let s = newSession(7, { red: 'war', blue: 'life' }, cardIndex, 'vsNpc');
    const r = lock(s, 'blue', emptyOrders());
    if (!r.ok) throw new Error(r.error);
    s = r.session;
    expect(s.screen).toEqual({ kind: 'report' });
    expect(s.state.turn).toBe(2);
    // red's moves and new recruits are in the report
    const titles = s.report!.sections.map((x) => x.title);
    expect(titles).toContain('Movement');
    expect(s.report!.sections.find((x) => x.title === 'Movement')!.lines.some((l) => l.startsWith('Red'))).toBe(true);
    s = afterReport(s);
    expect(s.screen).toEqual({ kind: 'orders', side: 'blue' });
    expect(s.state.players.red.confirmed).toBe(true);
  });

  it('lets the computer pick mana for its captures and asks the human for theirs', () => {
    let s = newSession(7, { red: 'war', blue: 'war' }, cardIndex, 'vsNpc');
    const towns = Object.values(s.state.structures).filter((x) => x.kind === 'town');
    // park each side on a town; red stands still this turn
    groupOf(s.state, 'red').pos = { ...towns[0].pos };
    groupOf(s.state, 'blue').pos = { ...towns[1].pos };
    s.state.players.red.orders = emptyOrders();
    const r = lock(s, 'blue', emptyOrders());
    if (!r.ok) throw new Error(r.error);
    s = afterReport(r.session);
    expect(s.screen).toEqual({ kind: 'mana', side: 'blue' });
    expect(s.state.structures[towns[0].id].manaType).not.toBeNull();
    s = pickMana(s, 'blue', towns[1].id, 'order');
    expect(s.state.structures[towns[1].id].manaType).toBe('order');
    expect(s.screen).toEqual({ kind: 'orders', side: 'blue' });
    expect(s.state.players.red.confirmed).toBe(true);
  });

  it('autosaves blue orders (and the mode) and resumes there', () => {
    const store = memory();
    const s = newSession(7, { red: 'war', blue: 'life' }, cardIndex, 'vsNpc');
    expect(isSafePoint(s)).toBe(true);
    expect(saveSession(s, store)).toBe(true);
    const back = loadSession(store)!;
    expect(back.mode).toBe('vsNpc');
    expect(back.screen).toEqual({ kind: 'orders', side: 'blue' });
    expect(back.state).toEqual(s.state);
  });

  it('defaults to hotseat in the model', () => {
    expect(newSession(7, { red: 'war', blue: 'life' }).mode).toBe('hotseat');
  });
});

describe('vs computer app', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });
  const click = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));

  it('defaults to vs computer and plays turns without hand-offs', () => {
    render(<App />);
    expect((screen.getByLabelText(/Mode/) as HTMLSelectElement).value).toBe('vsNpc');
    click(/Start game/);
    for (let turn = 1; turn <= 3; turn++) {
      expect(screen.getByRole('heading', { name: new RegExp(`Blue's orders · Turn ${turn}`) })).toBeTruthy();
      expect(screen.getByText(/You are Blue · vs computer \(Red\)/)).toBeTruthy();
      expect(screen.queryByText(/Pass the device/)).toBeNull();
      click(/Lock orders/);
      expect(screen.getByRole('heading', { name: new RegExp(`Turn ${turn} report`) })).toBeTruthy();
      click(/Next turn/);
    }
  });

  it('resumes a vs computer game on blue orders', () => {
    render(<App />);
    click(/Start game/);
    cleanup();
    render(<App />);
    click(/Resume game/);
    expect(screen.getByText(/You are Blue · vs computer \(Red\)/)).toBeTruthy();
  });
});
