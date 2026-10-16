import type { PlayerId, QueryContext, Ref, TargetType, TerrainId } from '@sanctum/engine';
import { INDIVIDUAL_TARGETS } from '../helpers';
import type { Fragment, TargetSpec } from './types';

const GROUP_TYPES: TargetType[] = ['recruitGroup', 'monsterGroup', 'group'];

export class TargetBuilder {
  constructor(readonly spec: TargetSpec) {}
  get friendly(): TargetBuilder {
    return new TargetBuilder({ ...this.spec, friendly: true });
  }
  get nonFriendly(): TargetBuilder {
    return new TargetBuilder({ ...this.spec, nonFriendly: true });
  }
  /** Single-minion targets only (recruit, swordsman, archer). */
  get alone(): TargetBuilder {
    if (!INDIVIDUAL_TARGETS.includes(this.spec.type)) throw new Error(`Target: .alone needs a single-minion target, not "${this.spec.type}"`);
    return new TargetBuilder({ ...this.spec, alone: true });
  }
  with(cls: 'swordsmen' | 'archers'): TargetBuilder {
    return new TargetBuilder({ ...this.spec, cls: cls === 'swordsmen' ? 'swordsman' : 'archer' });
  }
  /** Square targets only. */
  on(...terrain: TerrainId[]): TargetBuilder {
    if (this.spec.type !== 'square') throw new Error(`Target: .on(terrain) needs a square target, not "${this.spec.type}"`);
    return new TargetBuilder({ ...this.spec, terrain });
  }
  /** Group or single-minion targets: the target must stand on one of these terrains. */
  in(...terrain: TerrainId[]): TargetBuilder {
    if (['square', 'globe', 'structure'].includes(this.spec.type)) throw new Error(`Target: .in(terrain) needs a group or minion target, not "${this.spec.type}"`);
    return new TargetBuilder({ ...this.spec, in: terrain });
  }
  private groupOnly(what: string): void {
    if (!GROUP_TYPES.includes(this.spec.type)) throw new Error(`Target: .${what} needs a group target, not "${this.spec.type}"`);
  }
  get playerControlled(): TargetBuilder {
    this.groupOnly('playerControlled');
    return new TargetBuilder({ ...this.spec, playerControlled: true });
  }
  get notInStructure(): TargetBuilder {
    this.groupOnly('notInStructure');
    return new TargetBuilder({ ...this.spec, notInStructure: true });
  }
  atLeast(n: number): TargetBuilder {
    this.groupOnly('atLeast');
    return new TargetBuilder({ ...this.spec, minSize: n });
  }
  atMost(n: number): TargetBuilder {
    this.groupOnly('atMost');
    return new TargetBuilder({ ...this.spec, maxSize: n });
  }
}

export const Target = {
  globe: new TargetBuilder({ type: 'globe' }),
  group: new TargetBuilder({ type: 'group' }),
  recruitGroup: new TargetBuilder({ type: 'recruitGroup' }),
  recruit: new TargetBuilder({ type: 'recruit' }),
  swordsman: new TargetBuilder({ type: 'recruit', cls: 'swordsman' }),
  archer: new TargetBuilder({ type: 'recruit', cls: 'archer' }),
  square: new TargetBuilder({ type: 'square' }),
  structure: new TargetBuilder({ type: 'structure' }),
};

export const toTargetSpec = (t: TargetSpec | TargetBuilder): TargetSpec => (t instanceof TargetBuilder ? t.spec : t);

const ownerOf = (q: QueryContext, ref: Ref): PlayerId | undefined =>
  ref.kind === 'minion' ? q.minion(ref.id)?.owner
  : ref.kind === 'group' ? q.group(ref.id)?.owner
  : ref.kind === 'structure' ? q.structure(ref.id)?.owner
  : undefined;

/** The casting requirements a target spec implies, as a `canCast`. */
export function targetFragment(t: TargetSpec): Fragment {
  const checks: Array<(q: QueryContext, ref: Ref) => boolean> = [];
  if (t.friendly) checks.push((q, r) => ownerOf(q, r) === q.caster);
  if (t.nonFriendly) checks.push((q, r) => ownerOf(q, r) !== q.caster);
  if (t.cls && (t.type === 'recruit' || t.type === 'minion' || t.type === 'monster')) {
    checks.push((q, r) => {
      const m = r.kind === 'minion' ? q.minion(r.id) : undefined;
      return !!m && (m.cls === t.cls || (m.kind === 'recruit' && q.stats(m.id).dualClass));
    });
  }
  if (t.cls && GROUP_TYPES.includes(t.type)) {
    checks.push((q, r) => r.kind === 'group' && q.minionsOf(r.id).some((m) => m.cls === t.cls));
  }
  if (t.alone) {
    checks.push((q, r) => {
      const m = r.kind === 'minion' ? q.minion(r.id) : undefined;
      return !!m && q.minionsOf(m.groupId).length === 1;
    });
  }
  if (t.terrain) {
    checks.push((q, r) => r.kind === 'square' && t.terrain!.includes(q.terrainAt(r.pos) as TerrainId));
  }
  if (t.in) {
    checks.push((q, r) => {
      const g = r.kind === 'group' ? q.group(r.id) : r.kind === 'minion' ? q.group(q.minion(r.id)?.groupId ?? -1) : undefined;
      return !!g?.pos && t.in!.includes(q.terrainAt(g.pos) as TerrainId);
    });
  }
  const groupOf = (q: QueryContext, r: Ref) => (r.kind === 'group' ? q.group(r.id) : undefined);
  if (t.minSize !== undefined) checks.push((q, r) => r.kind === 'group' && q.minionsOf(r.id).length >= t.minSize!);
  if (t.maxSize !== undefined) checks.push((q, r) => r.kind === 'group' && q.minionsOf(r.id).length <= t.maxSize!);
  if (t.notInStructure) checks.push((q, r) => { const g = groupOf(q, r); return !!g?.pos && !q.structureAt(g.pos); });
  if (t.playerControlled) checks.push((q, r) => groupOf(q, r)?.control === 'player');
  return checks.length ? { canCast: (q, r) => checks.every((f) => f(q, r)) } : {};
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const COUNT = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

/** "Friendly recruit group." / "Swordsman alone in its group." / "Forest square." ... */
export function printTarget(t: TargetSpec): string {
  if (t.type === 'globe') return 'Globe.';
  let noun: string;
  switch (t.type) {
    case 'recruit': noun = t.cls ? cap(t.cls) : 'Recruit'; break;
    case 'monster': noun = 'Monster'; break;
    case 'minion': noun = 'Minion'; break;
    case 'recruitGroup': noun = 'Recruit group'; break;
    case 'monsterGroup': noun = 'Monster group'; break;
    case 'group': noun = 'Group'; break;
    case 'structure': noun = 'Town or colony'; break;
    default: noun = t.terrain ? `${cap(t.terrain.join(' or '))} square` : 'Square';
  }
  if (t.cls && GROUP_TYPES.includes(t.type)) noun += ` with ${t.cls === 'swordsman' ? 'swordsmen' : 'archers'}`;
  if (t.minSize !== undefined) noun += ` of ${COUNT[t.minSize] ?? t.minSize} or more`;
  if (t.maxSize !== undefined) noun += ` of ${COUNT[t.maxSize] ?? t.maxSize} or less`;
  if (t.in) noun += ` in ${t.in.join(' or ')}`;
  if (t.alone) noun += ' alone in its group';
  if (t.notInStructure) noun += ' not in a structure';
  const prefix = t.playerControlled ? 'Player-controlled ' : t.friendly ? 'Friendly ' : t.nonFriendly ? 'Non-friendly ' : '';
  return `${prefix ? prefix + lowerFirst(noun) : noun}.`;
}
