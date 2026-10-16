import { killMinion } from './death';
import type { Engine } from './engine';
import { dispatch } from './events';
import type { Ref } from './types';

export interface DamageSpec {
  kind: 'hand' | 'missile' | 'spell';
  ignoresArmor: boolean;
  magical: boolean;
}

/**
 * The Takes-Damage pipeline (rules: Pipelines/damage). Does not run the death pipeline;
 * callers do that when the result is 'killed'.
 * D1 before armor + is-hit-by, D2 armor soak, D3 cap + after armor, D4 apply.
 */
export function takeDamage(
  e: Engine, victimId: number, qty: number, dmg: DamageSpec, attackerId: number | null,
): 'bounced' | 'damaged' | 'killed' {
  const v = e.state.minions[victimId];
  const ref: Ref = { kind: 'minion', id: victimId };
  const data: Record<string, any> = {
    damage: qty, kind: dmg.kind, magical: dmg.magical, ignoresArmor: dmg.ignoresArmor, attackerId, victimId,
  };
  if (!dmg.magical) dispatch(e, 'attack:beforeArmor', ref, data);
  if (attackerId !== null) dispatch(e, 'attack:hit', ref, data);
  let q = Math.max(0, data.damage);
  if (!dmg.ignoresArmor && !dmg.magical) {
    const soak = Math.min(q, v.combat.armor);
    q -= soak;
    v.combat.armor -= soak;
    if (q === 0) return 'bounced';
  }
  data.damage = Math.min(q, v.hp);
  delete data.cancel; // only a cancel set at armor:after counts (rules)
  dispatch(e, 'armor:after', ref, data);
  if (data.cancel) return 'bounced';
  if (v.status === 'dead') return 'killed';
  v.hp -= Math.max(0, Math.min(data.damage, v.hp));
  return v.hp > 0 ? 'damaged' : 'killed';
}

/** Spell/terrain damage: magical by default (ignores armor); `{ magical: false }` respects armor and fires beforeArmor handlers, nobody to blame, death is a "dies" death. */
export function applyDamage(e: Engine, victimId: number, qty: number, opts: { magical?: boolean } = {}): void {
  const s = e.state;
  const v = s.minions[victimId];
  if (!v || v.status === 'dead') return;
  if (s.groups[v.groupId]?.pos == null) return;
  const res = takeDamage(e, victimId, qty, { kind: 'spell', magical: opts.magical ?? true, ignoresArmor: opts.magical ?? true }, null);
  if (res === 'killed') killMinion(e, victimId, null, 'dies');
}
