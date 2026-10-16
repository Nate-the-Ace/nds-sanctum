import { describe, expect, it } from 'vitest';
import { emptyOrders } from '@sanctum/engine';
import { clearSaved, isSafePoint, loadSession, saveSession, type SaveStore } from '../src/model/persist';
import { afterReport, begin, lock, newSession } from '../src/model/session';

function memory(): SaveStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const broken: SaveStore = {
  getItem: () => { throw new Error('denied'); },
  setItem: () => { throw new Error('quota'); },
  removeItem: () => { throw new Error('denied'); },
};

describe('autosave', () => {
  it('saves at the hand-off to red and restores the same game', () => {
    const store = memory();
    const s = newSession(7, { red: 'war', blue: 'life' });
    expect(isSafePoint(s)).toBe(true);
    expect(saveSession(s, store)).toBe(true);
    const back = loadSession(store)!;
    expect(back.screen).toEqual({ kind: 'handoff', to: 'red' });
    expect(back.state).toEqual(s.state);
    expect(back.cards).toBe(s.cards);
  });

  it('saves the report screen and restores the report', () => {
    const store = memory();
    let r = lock(begin(newSession(7, { red: 'war', blue: 'life' }), 'red'), 'red', emptyOrders());
    if (!r.ok) throw new Error(r.error);
    expect(isSafePoint(r.session)).toBe(false);
    expect(saveSession(r.session, store)).toBe(false);
    expect(store.data.size).toBe(0);
    r = lock(begin(r.session, 'blue'), 'blue', emptyOrders());
    if (!r.ok) throw new Error(r.error);
    expect(isSafePoint(r.session)).toBe(true);
    saveSession(r.session, store);
    const back = loadSession(store)!;
    expect(back.screen).toEqual({ kind: 'report' });
    expect(back.report).toEqual(r.session.report);
    expect(afterReport(back).screen).toEqual({ kind: 'handoff', to: 'red' });
  });

  it('never saves an orders screen', () => {
    const s = begin(newSession(7, { red: 'war', blue: 'life' }), 'red');
    expect(isSafePoint(s)).toBe(false);
  });

  it('survives storage that throws or holds junk', () => {
    const s = newSession(7, { red: 'war', blue: 'life' });
    expect(saveSession(s, broken)).toBe(false);
    expect(loadSession(broken)).toBeNull();
    expect(() => clearSaved(broken)).not.toThrow();
    expect(loadSession(null)).toBeNull();
    const store = memory();
    store.setItem('sanctum.save', '{not json');
    expect(loadSession(store)).toBeNull();
    store.setItem('sanctum.save', JSON.stringify({ v: 999 }));
    expect(loadSession(store)).toBeNull();
  });

  it('clears the save', () => {
    const store = memory();
    saveSession(newSession(7, { red: 'war', blue: 'life' }), store);
    clearSaved(store);
    expect(loadSession(store)).toBeNull();
  });
});
