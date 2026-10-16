import type { EventContext, StatDelta } from '@sanctum/engine';
import type { Fragment } from './types';

/* ---------- StatDelta ---------- */

type StatMerger<K extends keyof StatDelta> = (a: StatDelta[K], b: NonNullable<StatDelta[K]>) => StatDelta[K];
const sum = (a: number | undefined, b: number) => (a ?? 0) + b;
const either = (a: boolean | undefined, b: boolean) => (a || b) || undefined;

/** One merge rule per `StatDelta` field: adding a field to the engine type fails to compile until it has one. */
const STAT_MERGERS: { [K in keyof StatDelta]-?: StatMerger<K> } = {
  hand: sum,
  missile: sum,
  armor: sum,
  maxHp: sum,
  level: sum,
  handAttacks: sum,
  missileAttacks: sum,
  walks: (a, b) => [...(a ?? []), ...b],
  noDamage: either,
  concealed: either,
};

export function addStats(a: StatDelta, b: StatDelta): StatDelta {
  const out: StatDelta = { ...a };
  for (const key of Object.keys(STAT_MERGERS) as Array<keyof StatDelta>) {
    const v = b[key];
    if (v === undefined) continue;
    const merged = (STAT_MERGERS[key] as StatMerger<typeof key>)(out[key] as never, v as never);
    if (merged === undefined) delete out[key];
    else (out as Record<string, unknown>)[key] = merged;
  }
  return out;
}

/* ---------- Fragment ---------- */

type Merger<K extends keyof Fragment> = (vals: Array<NonNullable<Fragment[K]>>) => Fragment[K];

/** Every fragment must agree on this value (identical, or reference-equal for functions). */
const same =
  <K extends keyof Fragment>(field: K, eq: (a: NonNullable<Fragment[K]>, b: NonNullable<Fragment[K]>) => boolean): Merger<K> =>
  (vals) => {
    for (const v of vals.slice(1)) {
      if (!eq(vals[0], v)) throw new Error(`keywords set conflicting "${field}" values`);
    }
    return vals[0];
  };

type OnHandler = (c: EventContext, ev: unknown) => void;

/** One merge rule per `Fragment` (= `CardDef` hook) field: adding a field to `CardDef` fails to compile until it has one. */
const MERGERS: { [K in keyof Fragment]-?: Merger<K> } = {
  stats: (fs) => (q, id, sp) => fs.reduce((acc, f) => addStats(acc, f(q, id, sp)), {} as StatDelta),
  canCast: (fs) => (q, t) => fs.every((f) => f(q, t)),
  persistent: (fs) => (q, h) => fs.every((f) => f(q, h)),
  blocksCast: (fs) => (q, sp, a) => fs.some((f) => f(q, sp, a)),
  onCast: (fs) => (c, t) => fs.forEach((f) => f(c, t)),
  onExpire: (fs) => (c) => fs.forEach((f) => f(c)),
  on: (maps) => {
    const handlers = new Map<string, OnHandler[]>();
    for (const m of maps) {
      for (const [type, fn] of Object.entries(m)) {
        if (fn) handlers.set(type, [...(handlers.get(type) ?? []), fn as OnHandler]);
      }
    }
    const on: Record<string, OnHandler> = {};
    for (const [type, fns] of handlers) {
      on[type] = (c, ev) => {
        for (const fn of fns) {
          fn(c, ev);
          // A handler that dispelled the spell ends it: later keywords do not react to the same event.
          if (!c.state.spells.some((sp) => sp.id === c.spell.id)) return;
        }
      };
    }
    return on as Fragment['on'];
  },
  duration: same('duration', (a, b) => a.turns === b.turns),
  bot: same('bot', (a, b) => a === b),
  exclusive: (vs) => (vs.includes(false) ? false : true),
  visible: (vs) => (vs.includes(false) ? false : true),
  ignoresConcealment: (vs) => (vs.includes(true) ? true : undefined),
  helper: (vs) => (vs.includes(true) ? true : undefined),
};

/** Combine keyword contributions into one set of `CardDef` hooks. */
export function mergeFragments(frags: Fragment[]): Fragment {
  const out: Fragment = {};
  for (const key of Object.keys(MERGERS) as Array<keyof Fragment>) {
    const vals = frags.map((f) => f[key]).filter((v) => v !== undefined);
    if (!vals.length) continue;
    const merged = (MERGERS[key] as Merger<typeof key>)(vals as never);
    if (merged !== undefined) (out as Record<string, unknown>)[key] = merged;
  }
  return out;
}
