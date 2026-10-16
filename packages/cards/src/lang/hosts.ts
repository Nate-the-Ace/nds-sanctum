import type { TargetType } from '@sanctum/engine';
import { GROUP_TARGETS, INDIVIDUAL_TARGETS } from '../helpers';
import type { CompileCtx } from './types';

export type HostKind = 'group' | 'minion' | 'globe';

const ACCEPTS: Record<HostKind, (t: TargetType) => boolean> = {
  group: (t) => GROUP_TARGETS.includes(t),
  minion: (t) => INDIVIDUAL_TARGETS.includes(t),
  globe: (t) => t === 'globe',
};

const NOUN: Record<HostKind, string> = {
  group: 'a group target (recruit group, group)',
  minion: 'a minion target (recruit, swordsman, archer)',
  globe: 'the globe as its target',
};

/** Throws a clear compile-time error when a keyword's spell host cannot be what it expects. */
export function requireHost(ctx: CompileCtx, host: HostKind, what: string): void {
  if (!ACCEPTS[host](ctx.target.type)) {
    throw new Error(`card "${ctx.cardId}": ${what} needs ${NOUN[host]}, not "${ctx.target.type}"`);
  }
}
