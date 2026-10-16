import { step } from '@sanctum/engine';
import type { BotContext, Dir, Pos } from '@sanctum/engine';
import { defineKeyword } from '../registry';
import { hostGroupId } from '../scopes';
import type { Keyword } from '../types';

const manhattan = (a: Pos, b: Pos) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const chebyshev = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Nearest hostile recruit group (optionally only those `within` accepts), as a position. */
function nearestFoe(q: BotContext, gid: number, within?: (p: Pos) => boolean): Pos | null {
  const g = q.group(gid);
  if (!g?.pos) return null;
  let best: Pos | null = null;
  let bestD = Infinity;
  for (const o of Object.values(q.state.groups)) {
    if (!o.pos || o.kind !== 'recruit' || !q.hostile(g, o) || (within && !within(o.pos))) continue;
    const d = manhattan(g.pos, o.pos);
    if (d < bestD) {
      bestD = d;
      best = o.pos;
    }
  }
  return best;
}

/** One step that closes the distance (never onto the foe: combat happens between adjacent groups). */
function stepToward(q: BotContext, gid: number, target: Pos, allowed?: (p: Pos) => boolean): Dir | null {
  const from = q.group(gid)!.pos!;
  if (manhattan(from, target) <= 1) return null;
  const options = q.legalDirections(gid).filter((d) => {
    const p = step(from, d);
    return manhattan(p, target) < manhattan(from, target) && (!allowed || allowed(p));
  });
  return options.length ? options[Math.floor(q.random() * options.length)] : null;
}

export function territorialBot(q: BotContext, gid: number): Dir | null {
  const g = q.group(gid);
  const home = g?.home ?? g?.pos;
  if (!g || !home) return null;
  const foe = nearestFoe(q, gid, (p) => chebyshev(p, home) <= 2);
  return foe ? stepToward(q, gid, foe, (p) => chebyshev(p, home) <= 1) : null;
}

export function nomadicBot(q: BotContext, gid: number): Dir | null {
  const foe = nearestFoe(q, gid);
  if (foe) return stepToward(q, gid, foe);
  const dirs = q.legalDirections(gid);
  return dirs.length ? dirs[Math.floor(q.random() * dirs.length)] : null;
}

export const immobileBot = (): Dir | null => null;

export const Territorial = (): Keyword => ({ kind: 'territorial' });
export const Nomadic = (): Keyword => ({ kind: 'nomadic' });
export const Immobile = (): Keyword => ({ kind: 'immobile' });

defineKeyword({
  kind: 'territorial', term: 'Territorial', tier: 'core',
  gloss: 'The monster keeps to a 3x3 territory around its home square (where it was summoned) and hunts hostile recruit groups near it. If something forces it out, the square where it stops becomes its new home.',
  print: () => ({ layout: 'inline', text: 'Territorial' }),
  compile: () => ({
    bot: territorialBot,
    on: {
      'group:move': (c, ev) => {
        const gid = hostGroupId(c);
        if (gid === undefined || ev.ref?.kind !== 'group' || ev.ref.id !== gid) return;
        const g = c.group(gid);
        const to = ev.data.to as Pos;
        if (g?.home && chebyshev(to, g.home) > 1) c.setHome(gid, to);
      },
    },
  }),
});

defineKeyword({
  kind: 'nomadic', term: 'Nomadic', tier: 'core',
  gloss: 'The monster is unrestricted: it roams the whole board and hunts the nearest hostile recruit group.',
  print: () => ({ layout: 'inline', text: 'Nomadic' }),
  compile: () => ({ bot: nomadicBot }),
});

defineKeyword({
  kind: 'immobile', term: 'Immobile', tier: 'core',
  gloss: 'The monster cannot be moved at all; it ignores every order and effect that would move it.',
  print: () => ({ layout: 'inline', text: 'Immobile' }),
  compile: () => ({
    bot: immobileBot,
    on: {
      'movement:before': (c) => {
        const gid = hostGroupId(c);
        if (gid !== undefined) c.setMoveOrder(gid, null);
      },
    },
  }),
});
