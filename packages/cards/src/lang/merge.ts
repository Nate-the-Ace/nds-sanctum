import type { StatDelta } from '@sanctum/engine';
import type { Fragment } from './types';

const NUMERIC = ['hand', 'missile', 'armor', 'maxHp', 'level', 'handAttacks', 'missileAttacks'] as const;

export function addStats(a: StatDelta, b: StatDelta): StatDelta {
  const out: StatDelta = { ...a };
  for (const k of NUMERIC) {
    if (b[k] !== undefined) out[k] = (out[k] ?? 0) + b[k]!;
  }
  if (b.walks) out.walks = [...(out.walks ?? []), ...b.walks];
  if (b.noDamage) out.noDamage = true;
  if (b.concealed) out.concealed = true;
  return out;
}

const present = <T>(xs: Array<T | undefined>): T[] => xs.filter((x): x is T => x !== undefined);

/** Combine keyword contributions into one set of `CardDef` hooks. */
export function mergeFragments(frags: Fragment[]): Fragment {
  const out: Fragment = {};

  const stats = present(frags.map((f) => f.stats));
  if (stats.length) out.stats = (q, id, sp) => stats.reduce((acc, f) => addStats(acc, f(q, id, sp)), {} as StatDelta);

  const canCast = present(frags.map((f) => f.canCast));
  if (canCast.length) out.canCast = (q, t) => canCast.every((f) => f(q, t));

  const persistent = present(frags.map((f) => f.persistent));
  if (persistent.length) out.persistent = (q, h) => persistent.every((f) => f(q, h));

  const blocks = present(frags.map((f) => f.blocksCast));
  if (blocks.length) out.blocksCast = (q, sp, a) => blocks.some((f) => f(q, sp, a));

  const onCast = present(frags.map((f) => f.onCast));
  if (onCast.length) out.onCast = (c, t) => onCast.forEach((f) => f(c, t));

  const onExpire = present(frags.map((f) => f.onExpire));
  if (onExpire.length) out.onExpire = (c) => onExpire.forEach((f) => f(c));

  const handlers = new Map<string, Array<(c: never, ev: never) => void>>();
  for (const f of frags) {
    for (const [type, fn] of Object.entries(f.on ?? {})) {
      if (!fn) continue;
      handlers.set(type, [...(handlers.get(type) ?? []), fn as (c: never, ev: never) => void]);
    }
  }
  if (handlers.size) {
    const on: NonNullable<Fragment['on']> = {};
    for (const [type, fns] of handlers) {
      (on as Record<string, (c: unknown, ev: unknown) => void>)[type] = (c, ev) =>
        fns.forEach((fn) => (fn as (c: unknown, ev: unknown) => void)(c, ev));
    }
    out.on = on;
  }

  for (const f of frags) {
    if (f.duration) out.duration = f.duration;
    if (f.bot) out.bot = f.bot;
    if (f.exclusive === false) out.exclusive = false;
    if (f.visible === false) out.visible = false;
    if (f.ignoresConcealment) out.ignoresConcealment = true;
    if (f.helper) out.helper = true;
  }
  return out;
}
