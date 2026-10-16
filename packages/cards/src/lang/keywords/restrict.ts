import type { EventContext, QueryContext, TargetType } from '@sanctum/engine';
import { GROUP_TARGETS, hasEnchantments, INDIVIDUAL_TARGETS } from '../../helpers';
import { defineKeyword } from '../registry';
import type { Keyword } from '../types';

export type SpellClass = 'globe' | 'structure' | 'group' | 'individual';

const classOf = (t: TargetType): SpellClass | undefined =>
  t === 'globe' ? 'globe'
  : t === 'structure' ? 'structure'
  : GROUP_TARGETS.includes(t) ? 'group'
  : INDIVIDUAL_TARGETS.includes(t) ? 'individual'
  : undefined;

/* ---------- Forbid ---------- */

export interface ForbidKeyword extends Keyword {
  kind: 'forbid';
  spells: SpellClass[];
  by?: 'caster';
  friendly: boolean;
}
/** While active, spells of these classes cannot be cast. `by: 'caster'` limits it to this spell's caster; `friendly` to targets that caster owns. */
export const Forbid = (spells: SpellClass[], opts: { by?: 'caster'; friendly?: boolean } = {}): ForbidKeyword => ({
  kind: 'forbid', spells, by: opts.by, friendly: opts.friendly ?? false,
});

defineKeyword<ForbidKeyword>({
  kind: 'forbid', term: 'Forbid', tier: 'house',
  gloss: 'While this lasts, spells of the named classes cannot be cast; they squander. Globe, structure, group and individual spells are the classes.',
  print: (k) => {
    const base = `${k.spells.join(' or ')} spells`;
    const text = k.by === 'caster'
      ? `Caster: no ${base}${k.friendly ? ' on friends' : ''}.`
      : `No ${base}.`;
    return { layout: 'line', text };
  },
  compile: (k) => ({
    blocksCast: (q, sp, a) => {
      const cls = classOf(a.card.target);
      if (!cls || !k.spells.includes(cls)) return false;
      if (k.by === 'caster' && a.caster !== sp.owner) return false;
      if (k.friendly) {
        const owner = a.target.kind === 'group' ? q.group(a.target.id)?.owner
          : a.target.kind === 'minion' ? q.minion(a.target.id)?.owner
          : undefined;
        if (owner !== sp.owner) return false;
      }
      return true;
    },
  }),
});

/* ---------- Shroud ---------- */

export interface ShroudKeyword extends Keyword {
  kind: 'shroud';
  from: Array<'group' | 'individual'>;
  against?: 'friendly';
}
/** The host (a group or a minion) cannot be targeted by group and/or individual spells. */
export const Shroud = (opts: { from?: Array<'group' | 'individual'>; against?: 'friendly' } = {}): ShroudKeyword => ({
  kind: 'shroud', from: opts.from ?? ['group', 'individual'], against: opts.against,
});

defineKeyword<ShroudKeyword>({
  kind: 'shroud', term: 'Shroud', tier: 'house',
  gloss: 'Cannot be targeted by the named kinds of spell (group spells aimed at the group, individual spells aimed at its members). Optionally only by friendly casters.',
  print: (k) => {
    const q = [k.against === 'friendly' ? 'friendly' : '', k.from.length === 2 ? '' : k.from[0]].filter(Boolean).join(' ');
    return { layout: 'inline', text: q ? `Shroud (${q} spells)` : 'Shroud' };
  },
  compile: (k) => ({
    blocksCast: (q: QueryContext, sp, a) => {
      const cls = classOf(a.card.target);
      if (cls !== 'group' && cls !== 'individual') return false;
      if (!k.from.includes(cls)) return false;
      const host = sp.host;
      let hostGroupId: number | undefined;
      let hostMinionId: number | undefined;
      let owner;
      if (host.kind === 'group') {
        hostGroupId = host.id;
        owner = q.group(host.id)?.owner;
      } else if (host.kind === 'minion') {
        const m = q.minion(host.id);
        hostMinionId = host.id;
        hostGroupId = m?.groupId;
        owner = m?.owner;
      } else {
        return false;
      }
      if (k.against === 'friendly' && a.caster !== owner) return false;
      if (cls === 'group') return a.target.kind === 'group' && a.target.id === hostGroupId;
      if (a.target.kind !== 'minion') return false;
      return hostMinionId !== undefined ? a.target.id === hostMinionId : q.minion(a.target.id)?.groupId === hostGroupId;
    },
  }),
});

/* ---------- Warded ---------- */

export interface WardedKeyword extends Keyword {
  kind: 'warded';
  reduce?: number;
}
/** Combat damage from recruits without enchantments is cancelled after armor; `Warded(n)` reduces it by n before armor instead. */
export const Warded = (reduce?: number): WardedKeyword => ({ kind: 'warded', reduce });

defineKeyword<WardedKeyword>({
  kind: 'warded', term: 'Warded', tier: 'house',
  gloss: 'Takes no combat damage from recruits without enchantments (after armor). "Warded N": damage from them is reduced by N before armor.',
  print: (k) => ({ layout: 'inline', text: k.reduce === undefined ? 'Warded' : `Warded ${k.reduce}` }),
  compile: (k) => {
    const attackerOf = (c: EventContext, id: unknown) =>
      id == null ? undefined : c.minion(id as number);
    if (k.reduce === undefined) {
      return {
        on: {
          'armor:after': (c, ev) => {
            if (ev.ref?.kind !== 'minion' || c.host.kind !== 'minion' || ev.ref.id !== c.host.id) return;
            const attacker = attackerOf(c, ev.data.attackerId);
            if (attacker && attacker.kind === 'recruit' && !hasEnchantments(c, attacker)) c.cancel();
          },
        },
      };
    }
    return {
      on: {
        'attack:beforeArmor': (c, ev) => {
          if (ev.ref?.kind !== 'minion' || c.host.kind !== 'minion' || ev.ref.id !== c.host.id) return;
          const attacker = attackerOf(c, ev.data.attackerId);
          if (attacker && attacker.kind === 'recruit' && !hasEnchantments(c, attacker)) ev.data.damage -= k.reduce!;
        },
      },
    };
  },
});

/* ---------- Concealment ---------- */

export interface ConcealmentKeyword extends Keyword {
  kind: 'concealment';
}
/** Every minion is concealed from both sides. */
export const Concealment = (): ConcealmentKeyword => ({ kind: 'concealment' });
defineKeyword<ConcealmentKeyword>({
  kind: 'concealment', term: 'Concealment', tier: 'house',
  gloss: 'While active, every minion is Concealed from both sides: individual spells cannot target any minion (spells that ignore concealment still can).',
  print: () => ({ layout: 'line', text: 'All minions are Concealed.' }),
  compile: () => ({
    blocksCast: (_q, _sp, a) => classOf(a.card.target) === 'individual' && !a.card.ignoresConcealment,
  }),
});
