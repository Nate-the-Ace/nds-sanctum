import { cardIndex } from '@sanctum/cards';
import type { CardIndex } from '@sanctum/engine';
import type { Report } from './report';
import type { Mode, Screen, Session } from './session';

/** The part of Storage the autosave uses, so tests can pass an in-memory store. */
export type SaveStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const KEY = 'sanctum.save';
const VERSION = 1;

interface Saved {
  v: number;
  /** Absent in saves made before the vs-computer mode: those are hotseat games. */
  mode?: Mode;
  state: Session['state'];
  screen: Screen;
  report: Report | null;
}

/** localStorage when the browser lets us touch it (private windows and blocked site data may not). */
export function browserStore(): SaveStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Safe points hold no locked orders: the hand-off to red (start of a turn) and the turn report.
 * Never between red's lock and blue's lock, or red's hidden orders would sit in storage. Against the computer there
 * is nobody to hide red's orders from, so the start of blue's orders (red locked, blue not) is the turn's safe point.
 */
export function isSafePoint(s: Session): boolean {
  if (s.screen.kind === 'report') return true;
  if (s.mode === 'vsNpc') {
    return s.screen.kind === 'orders' && s.screen.side === 'blue' && s.state.players.blue.orders === null;
  }
  if (s.screen.kind !== 'handoff' || s.screen.to !== 'red') return false;
  return s.state.players.red.orders === null && s.state.players.blue.orders === null;
}

/** Saves the session if it is at a safe point. Returns whether it was written. */
export function saveSession(s: Session, store: SaveStore | null = browserStore()): boolean {
  if (!store || !isSafePoint(s)) return false;
  const data: Saved = { v: VERSION, mode: s.mode, state: s.state, screen: s.screen, report: s.report };
  try {
    store.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** The saved game, or null when there is none or it cannot be read. */
export function loadSession(store: SaveStore | null = browserStore(), cards: CardIndex = cardIndex): Session | null {
  if (!store) return null;
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Saved>;
    if (d.v !== VERSION || !d.state || !d.screen) return null;
    return { mode: d.mode === 'vsNpc' ? 'vsNpc' : 'hotseat', cards, state: d.state, screen: d.screen, report: d.report ?? null };
  } catch {
    return null;
  }
}

export function clearSaved(store: SaveStore | null = browserStore()): void {
  try {
    store?.removeItem(KEY);
  } catch {
    // nothing to do: storage is unavailable
  }
}
