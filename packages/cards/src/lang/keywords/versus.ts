import type { EventContext, HouseId, Minion, TerrainId } from '@sanctum/engine';
import { GROUP_TARGETS, INDIVIDUAL_TARGETS, isHostMinion } from '../../helpers';
import { requireHost } from '../hosts';
import { defineKeyword, keywordDef } from '../registry';
import type { Keyword } from '../types';
import { appliesTo, toDelta, type GrantStats, type GrantTo } from './statics';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const houses = (hs: HouseId[]) => hs.map(cap).join(' or ');
const statText = (s: GrantStats) => (['hand', 'missile', 'armor', 'level', 'maxHp'] as const)
  .filter((f) => s[f] !== undefined)
  .map((f) => `${s[f]! >= 0 ? '+' : '-'}${Math.abs(s[f]!)} ${{ hand: 'H', missile: 'M', armor: 'A', level: 'L', maxHp: 'HP' }[f]}`)
  .join(', ');

/* ---------- Against ---------- */

export interface AgainstKeyword extends Keyword {
  kind: 'against';
  houses: HouseId[];
  hand: number;
  missile: number;
  monstersOnly: boolean;
}
/** "+N H against <House> minions": extra damage when the host minion strikes a victim serving one of those houses. */
export const Against = (
  hs: HouseId[],
  opts: { hand?: number; missile?: number; monstersOnly?: boolean },
): AgainstKeyword => ({ kind: 'against', houses: hs, hand: opts.hand ?? 0, missile: opts.missile ?? 0, monstersOnly: opts.monstersOnly ?? false });

defineKeyword<AgainstKeyword>({
  kind: 'against', term: 'Against', tier: 'house',
  gloss: '"+N H against <House> minions": extra hand (or missile) damage when this minion strikes a victim that serves one of those houses.',
  print: (k) => {
    const stat = [k.hand ? `+${k.hand} H` : '', k.missile ? `+${k.missile} M` : ''].filter(Boolean).join(', ');
    return { layout: 'line', text: `${stat} against ${houses(k.houses)} ${k.monstersOnly ? 'monsters' : 'minions'}.` };
  },
  compile: (k, ctx) => {
    requireHost(ctx, 'minion', 'Against');
    return {
      on: {
        'attacker:strikes': (c, ev) => {
          if (!isHostMinion(c, ev)) return;
          const v = c.minion(ev.data.victimId);
          if (!v || (k.monstersOnly && v.kind !== 'monster') || !v.house || !k.houses.includes(v.house)) return;
          ev.data.damage += (ev.data.kind === 'hand' ? k.hand : k.missile) ?? 0;
        },
      },
    };
  },
});

/* ---------- Immune ---------- */

export interface ImmuneKeyword extends Keyword {
  kind: 'immune';
  houses: HouseId[];
}
/** The host minion cannot be targeted by individual spells of these houses. */
export const Immune = (hs: HouseId[]): ImmuneKeyword => ({ kind: 'immune', houses: hs });

defineKeyword<ImmuneKeyword>({
  kind: 'immune', term: 'Immune', tier: 'house',
  gloss: 'Cannot be targeted by individual spells of the named houses.',
  print: (k) => ({ layout: 'line', text: `Cannot be targeted by ${houses(k.houses)} individual spells.` }),
  compile: (k, ctx) => {
    requireHost(ctx, 'minion', 'Immune');
    return {
      blocksCast: (_q, sp, a) =>
        k.houses.includes(a.card.house) && INDIVIDUAL_TARGETS.includes(a.card.target) &&
        a.target.kind === 'minion' && sp.host.kind === 'minion' && a.target.id === sp.host.id,
    };
  },
});

/* ---------- Taunt ---------- */

/** Enemies that choose their victim must choose this minion (unpaired bashers and all shooters). */
export const Taunt = (): Keyword => ({ kind: 'taunt' });
defineKeyword({
  kind: 'taunt', term: 'Taunt', tier: 'house',
  gloss: 'In combat, enemies that choose their victim (all archers and unpaired non-archers) must attack this minion.',
  print: () => ({ layout: 'inline', text: 'Taunt' }),
  compile: () => ({ stats: () => ({ taunt: true }) }),
});

/* ---------- Aura ---------- */

export interface AuraKeyword extends Keyword {
  kind: 'aura';
  others: GrantStats;
  to: GrantTo;
  self?: GrantStats;
}
/** A group aura: the host minion's group members (of class `to`) get `others`; the host itself gets `self`. */
export const Aura = (others: GrantStats, opts: { to?: GrantTo; self?: GrantStats } = {}): AuraKeyword => ({
  kind: 'aura', others, to: opts.to ?? 'all', self: opts.self,
});

defineKeyword<AuraKeyword>({
  kind: 'aura', term: 'Group aura', tier: 'house',
  gloss: 'A bonus for everyone in the host minion\'s group (including the host unless it says otherwise); it ends when the host dies and follows the host into another group.',
  print: (k) => ({
    layout: 'line',
    text: `Group aura: ${k.to === 'all' ? 'minions' : k.to} ${statText(k.others)}${k.self ? `; this minion ${statText(k.self)}` : ''}.`,
  }),
  compile: (k, ctx) => {
    requireHost(ctx, 'minion', 'Aura');
    // groupAura is card-wide: the engine hands the card's whole stats to every group member, so no other keyword on
    // the card may contribute stats (they would silently become part of the aura).
    ctx.keywords.forEach((o, i) => {
      if (i === ctx.index) return;
      if (o.kind === 'aura' || keywordDef(o.kind).compile(o, { ...ctx, index: i }).stats) {
        throw new Error(`card "${ctx.cardId}": Aura cannot share a card with "${o.kind}", which also gives stats (put it on its own helper card)`);
      }
    });
    return {
      groupAura: true,
      stats: (q, id, spell) => {
        const m = q.minion(id);
        if (!m) return {};
        const hostId = spell.host.kind === 'minion' ? spell.host.id : -1;
        if (id === hostId) return k.self ? toDelta(k.self, m) : {};
        return appliesTo(k.to, m, spell) ? toDelta(k.others, m) : {};
      },
    };
  },
});

/* ---------- Versus ---------- */

export interface VersusVictim {
  /** The victim is of this class. */
  cls?: 'swordsman' | 'archer';
  /** The victim's group stands on one of these terrains, or in a structure. */
  in?: Array<TerrainId | 'structure'>;
}
export interface VersusKeyword extends Keyword {
  kind: 'versus';
  hand: number;
  missile: number;
  vs: VersusVictim;
  to: GrantTo;
}
/** "+N M against swordsmen": extra damage when an attacker of the host (minion, or `to` members of the host group) strikes such a victim. */
export const Versus = (bonus: { hand?: number; missile?: number }, vs: VersusVictim, opts: { to?: GrantTo } = {}): VersusKeyword => ({
  kind: 'versus', hand: bonus.hand ?? 0, missile: bonus.missile ?? 0, vs, to: opts.to ?? 'all',
});

const VERSUS_SUBJECT: Record<GrantTo, string> = { all: '', swordsmen: 'Swordsmen ', archers: 'Archers ', enemies: 'Enemy recruits ' };
const victimText = (vs: VersusVictim): string =>
  vs.cls ? (vs.cls === 'swordsman' ? 'swordsmen' : 'archers')
  : `groups in ${(vs.in ?? []).map((t) => (t === 'structure' ? 'a structure' : t)).join(' or ')}`;

function victimMatches(c: EventContext, v: Minion, vs: VersusVictim): boolean {
  if (vs.cls && v.cls !== vs.cls) return false;
  if (vs.in) {
    const pos = c.group(v.groupId)?.pos;
    if (!pos) return false;
    const inStructure = !!c.structureAt(pos) && vs.in.includes('structure');
    if (!inStructure && !vs.in.includes(c.terrainAt(pos) as TerrainId)) return false;
  }
  return true;
}

defineKeyword<VersusKeyword>({
  kind: 'versus', term: 'Versus', tier: 'house',
  gloss: '"+N M against <victims>": extra hand (H) or missile (M) damage when this minion, or the named members of this group, strike such a victim.',
  print: (k) => {
    const stat = [k.hand ? `+${k.hand} H` : '', k.missile ? `+${k.missile} M` : ''].filter(Boolean).join(', ');
    return { layout: 'line', text: `${VERSUS_SUBJECT[k.to]}${stat} against ${victimText(k.vs)}.` };
  },
  compile: (k, ctx) => {
    const t = ctx.host ?? ctx.target.type;
    const ok = t === 'minion' || t === 'group' || GROUP_TARGETS.includes(t as never) || INDIVIDUAL_TARGETS.includes(t as never);
    if (!ok) throw new Error(`card "${ctx.cardId}": Versus needs a minion or group target, not "${t}"`);
    return {
      on: {
        'attacker:strikes': (c, ev) => {
          if (ev.ref?.kind !== 'minion') return;
          const attacker = c.minion(ev.ref.id);
          if (!attacker) return;
          const mine = c.host.kind === 'minion' ? c.host.id === attacker.id : c.host.kind === 'group' && c.host.id === attacker.groupId;
          if (!mine || !appliesTo(k.to, attacker, c.spell)) return;
          const v = c.minion(ev.data.victimId);
          if (!v || !victimMatches(c, v, k.vs)) return;
          ev.data.damage += ev.data.kind === 'hand' ? k.hand : k.missile;
        },
      },
    };
  },
});
