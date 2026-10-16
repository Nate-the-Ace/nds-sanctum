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
    checks.push((q, r) => r.kind === 'minion' && q.minion(r.id)?.cls === t.cls);
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
  return checks.length ? { canCast: (q, r) => checks.every((f) => f(q, r)) } : {};
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

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
  if (t.alone) noun += ' alone in its group';
  const prefix = t.friendly ? 'Friendly ' : t.nonFriendly ? 'Non-friendly ' : '';
  return `${prefix ? prefix + lowerFirst(noun) : noun}.`;
}
