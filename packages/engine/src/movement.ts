import { distance2, key, parseKey, samePos, step } from './board';
import { makeBotContext } from './ctx';
import { killMinion } from './death';
import type { Engine } from './engine';
import { dispatch } from './events';
import { groupsAt, hostile, minionsOf, ownerRank, sequence, structureAt } from './query';
import { RULES } from './rules';
import { recheck } from './spells';
import { groupCanEnter } from './terrainfx';
import type { Dir, GameState, Group, Pos } from './types';
import { removeGroup } from './units';

interface Track {
  start: Pos;
  moved: boolean;
  bounced: boolean;
  seq: number;
  notified: boolean;
}
type Tracks = Map<number, Track>;

/** Track for a group, created lazily for groups born during movement. */
function trackOf(tracks: Tracks, g: Group): Track {
  let t = tracks.get(g.id);
  if (!t) {
    t = { start: { ...g.pos! }, moved: false, bounced: false, seq: tracks.size, notified: false };
    tracks.set(g.id, t);
  }
  return t;
}

function botMove(e: Engine, g: Group): Dir | null {
  const card = g.botId ? e.cards[g.botId] : undefined;
  return card?.bot ? card.bot(makeBotContext(e, g.owner), g.id) : null;
}

export function canEnterSquare(e: Engine, g: Group, dest: Pos): boolean {
  const s = e.state;
  if (!s.cells.includes(key(dest))) return false;
  if (!groupCanEnter(e, g, s.terrain[key(dest)])) return false;
  if (!groupCanEnter(e, g, s.terrain[key(g.pos!)])) return false; // exit check
  if (structureAt(s, dest) && (g.kind !== 'recruit' || g.control !== 'player')) return false;
  return true;
}

function canJoin(a: Group, b: Group): boolean {
  return (
    a.kind === 'recruit' && b.kind === 'recruit' && a.owner === b.owner && a.owner !== 'neutral' &&
    a.control === 'player' && b.control === 'player' &&
    a.minionIds.length + b.minionIds.length <= RULES.maxGroup
  );
}

/** Pass II ranking: stationary first, then initiative/neutral/non-initiative, then larger, then orders sequence. */
function rank(s: GameState, tracks: Tracks, pos: Pos, a: Group, b: Group): number {
  const stationary = (g: Group) => {
    const t = trackOf(tracks, g);
    return !t.moved && samePos(t.start, pos);
  };
  if (stationary(a) !== stationary(b)) return stationary(a) ? -1 : 1;
  const ra = ownerRank(s, a.owner);
  const rb = ownerRank(s, b.owner);
  if (ra !== rb) return ra - rb;
  if (a.minionIds.length !== b.minionIds.length) return b.minionIds.length - a.minionIds.length;
  return trackOf(tracks, a).seq - trackOf(tracks, b).seq;
}

function notify(e: Engine, g: Group, t: Track): void {
  if (t.notified) return;
  t.notified = true;
  if (!t.moved || !g.pos || samePos(g.pos, t.start)) return;
  const ref = { kind: 'group' as const, id: g.id };
  dispatch(e, 'group:exit', ref, { from: t.start });
  dispatch(e, 'group:move', ref, { from: t.start, to: g.pos });
  dispatch(e, 'group:enter', ref, { to: g.pos });
}

function join(e: Engine, tracks: Tracks, winner: Group, g: Group): void {
  const s = e.state;
  notify(e, g, trackOf(tracks, g));
  if (!s.groups[winner.id]) {
    bounce(e, tracks, g); // the winner vanished during notification; never merge into a deleted group
    return;
  }
  for (const mid of g.minionIds) {
    s.minions[mid].groupId = winner.id;
    winner.minionIds.push(mid);
  }
  g.minionIds = [];
  removeGroup(e, g.id);
  for (const mid of winner.minionIds) recheck(e, { kind: 'minion', id: mid });
  recheck(e, { kind: 'group', id: winner.id });
}

/** Second bounce: jump to the nearest empty, unoccupied, enterable square; if none exists, leave the game. */
function moonwalk(e: Engine, tracks: Tracks, g: Group): void {
  const s = e.state;
  const t = trackOf(tracks, g);
  let best: Pos | null = null;
  let bestD = Infinity;
  for (const k of s.cells) {
    const p = parseKey(k);
    if (groupsAt(s, p).some((o) => o.id !== g.id) || structureAt(s, p)) continue;
    if (!groupCanEnter(e, g, s.terrain[k])) continue;
    const d = distance2(t.start, p);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  if (!best) {
    for (const m of minionsOf(s, g.id)) killMinion(e, m.id, null, 'removed');
    return;
  }
  g.pos = best;
  t.moved = true;
}

function bounce(e: Engine, tracks: Tracks, g: Group): void {
  const t = trackOf(tracks, g);
  if (t.bounced) {
    moonwalk(e, tracks, g);
    return;
  }
  t.bounced = true;
  g.pos = { ...t.start };
}

function overstacks(s: GameState): Pos[] {
  const by = new Map<string, number>();
  for (const g of Object.values(s.groups)) {
    if (!g.pos) continue;
    by.set(key(g.pos), (by.get(key(g.pos)) ?? 0) + 1);
  }
  return [...by.entries()].filter(([, n]) => n > 1).map(([k]) => parseKey(k)).sort((a, b) => (key(a) < key(b) ? -1 : 1));
}

function resolveStacks(e: Engine, tracks: Tracks): void {
  const s = e.state;
  for (let guard = 0; guard < 200; guard++) {
    const piles = overstacks(s);
    if (piles.length === 0) return;
    for (const pos of piles) {
      const here = groupsAt(s, pos);
      if (here.length < 2) continue;
      const ranked = [...here].sort((a, b) => rank(s, tracks, pos, a, b));
      const winner = ranked[0];
      for (const g of ranked.slice(1)) {
        if (!s.groups[g.id] || !s.groups[winner.id] || !g.pos || !samePos(g.pos, pos)) continue;
        if (hostile(g, winner) || !canJoin(winner, g)) bounce(e, tracks, g);
        else join(e, tracks, winner, g);
      }
    }
  }
}

/** One movement pass: pass I (every group, or only those in `only`), pass II stacking, then notifications. */
function movePass(e: Engine, only?: Set<number>): void {
  const s = e.state;
  const list: Group[] = [];
  for (const p of sequence(s)) {
    const mine = s.groupSeq[p].map((id) => s.groups[id]).filter((g): g is Group => !!g && g.pos !== null);
    const players = mine.filter((g) => g.control === 'player');
    const issued = players.filter((g) => g.moveSeq !== null).sort((a, b) => a.moveSeq! - b.moveSeq!);
    const rest = players.filter((g) => g.moveSeq === null);
    list.push(...issued, ...rest, ...mine.filter((g) => g.control === 'computer'));
  }
  const tracks: Tracks = new Map();
  list.forEach((g, i) => tracks.set(g.id, { start: { ...g.pos! }, moved: false, bounced: false, seq: i, notified: false }));

  for (const g of list) {
    if (!g.moveOrder || !g.pos) continue;
    if (only && !only.has(g.id)) continue;
    if (g.owner === 'neutral' && g.control === 'player') continue;
    const dest = step(g.pos, g.moveOrder);
    if (!canEnterSquare(e, g, dest)) continue;
    if (groupsAt(s, dest).some((o) => o.id !== g.id && hostile(g, o))) continue;
    g.pos = dest;
    trackOf(tracks, g).moved = true;
  }
  resolveStacks(e, tracks);
  for (const g of list) {
    const cur = s.groups[g.id];
    if (cur) notify(e, cur, trackOf(tracks, cur));
  }
}

/**
 * The movement phase (rules: Pipelines/movement). Reads `moveOrder` from every group, then clears it.
 * Groups with `movesTwice` repeat their order in a second pass after "after movement" effects.
 */
export function runMovement(e: Engine): void {
  const s = e.state;
  dispatch(e, 'movement:before');
  for (const g of Object.values(s.groups)) if (g.control === 'computer' && g.pos) g.moveOrder = botMove(e, g);
  movePass(e);
  dispatch(e, 'movement:after');
  const again = new Set(
    Object.values(s.groups).filter((g) => g.movesTwice && g.moveOrder !== null).map((g) => g.id),
  );
  if (again.size > 0) movePass(e, again);
  for (const g of Object.values(s.groups)) {
    g.moveOrder = null;
    g.moveSeq = null;
    g.movesTwice = false;
  }
}
