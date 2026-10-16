import type { StatDelta, Walk as WalkKind, Minion, ActiveSpell } from '@sanctum/engine';
import { isHostGroup } from '../../helpers';
import { helperSummary } from '../render';
import { defineKeyword } from '../registry';
import type { Fragment, Keyword } from '../types';

/* ---------- Grant ---------- */

export interface GrantStats {
  hand?: number;
  missile?: number;
  armor?: number;
  level?: number;
  maxHp?: number;
  /** "+N attack each round": hand attacks for swordsmen and monsters, missile attacks for archers. */
  attacks?: number;
}
export type GrantTo = 'all' | 'swordsmen' | 'archers' | 'enemies';
export interface GrantKeyword extends Keyword {
  kind: 'grant';
  stats: GrantStats;
  to: GrantTo;
  heal: boolean;
}

/** Stat grants. `to` limits who gets them; `heal` also raises current hp by the max hp granted (target minion). */
export const Grant = (stats: GrantStats, opts: { to?: GrantTo; heal?: boolean } = {}): GrantKeyword => ({
  kind: 'grant', stats, to: opts.to ?? 'all', heal: opts.heal ?? false,
});

const ORDER = ['hand', 'missile', 'armor', 'level', 'maxHp', 'attacks'] as const;
const LABEL = { hand: 'H', missile: 'M', armor: 'A', level: 'L', maxHp: 'HP', attacks: 'Attack' } as const;
const SUBJECT: Record<GrantTo, string> = { all: '', swordsmen: 'Swordsmen ', archers: 'Archers ', enemies: 'Enemy recruits ' };

function appliesTo(to: GrantTo, m: Minion, spell: ActiveSpell): boolean {
  switch (to) {
    case 'swordsmen': return m.cls === 'swordsman';
    case 'archers': return m.cls === 'archer';
    case 'enemies': return m.kind === 'recruit' && m.owner !== spell.owner;
    default: return true;
  }
}

function toDelta(s: GrantStats, m: Minion): StatDelta {
  const d: StatDelta = {};
  if (s.hand !== undefined) d.hand = s.hand;
  if (s.missile !== undefined) d.missile = s.missile;
  if (s.armor !== undefined) d.armor = s.armor;
  if (s.level !== undefined) d.level = s.level;
  if (s.maxHp !== undefined) d.maxHp = s.maxHp;
  if (s.attacks !== undefined) {
    if (m.cls === 'archer') d.missileAttacks = s.attacks;
    else d.handAttacks = s.attacks;
  }
  return d;
}

defineKeyword<GrantKeyword>({
  kind: 'grant', term: 'Grant', tier: 'core',
  gloss: 'Adds stats (H hand damage, M missile damage, A armor, L level, HP maximum hit points, Attack extra attacks per round). "+N HP" also heals that much when cast on one minion.',
  print: (k) => ({
    layout: 'line',
    text: `${SUBJECT[k.to]}${ORDER.filter((s) => k.stats[s] !== undefined).map((s) => `${k.stats[s]! >= 0 ? '+' : '-'}${Math.abs(k.stats[s]!)} ${LABEL[s]}`).join(', ')}.`,
  }),
  compile: (k) => ({
    stats: (q, id, spell) => {
      const m = q.minion(id);
      return m && appliesTo(k.to, m, spell) ? toDelta(k.stats, m) : {};
    },
    ...(k.heal && k.stats.maxHp
      ? { onCast: (c, t) => { if (t.kind === 'minion') c.heal(t.id, k.stats.maxHp!); } }
      : {}),
  }),
});

/* ---------- Walks: Flight, Desertwalk, Waterwalk, Mountainwalk, Firewalk ---------- */

export interface WalkKeyword extends Keyword {
  kind: 'walk';
  walk: WalkKind;
}
export const Walk = (walk: WalkKind): WalkKeyword => ({ kind: 'walk', walk });
const WALK_NAME: Record<WalkKind, string> = {
  desert: 'Desertwalk', water: 'Waterwalk', mountain: 'Mountainwalk', fire: 'Firewalk', flight: 'Flight',
};
defineKeyword<WalkKeyword>({
  kind: 'walk', term: 'Terrainwalk', tier: 'core',
  gloss: 'Flight crosses any terrain and ignores terrain damage. Desertwalk, Waterwalk, Mountainwalk and Firewalk ignore that terrain (Mountainwalk crosses mountains and volcanoes but still takes volcano damage).',
  print: (k) => ({ layout: 'inline', text: WALK_NAME[k.walk] }),
  compile: (k) => ({ stats: () => ({ walks: [k.walk] }) }),
});

/* ---------- Simple statics ---------- */

const simple = <K extends Keyword>(
  kind: K['kind'], term: string, tier: 'core' | 'house' | 'oneoff', gloss: string, text: string, compile: (k: K) => Fragment,
) => defineKeyword<K>({ kind, term, tier, gloss, print: () => ({ layout: 'inline', text }), compile });

export interface ConcealedKeyword extends Keyword { kind: 'concealed' }
export const Concealed = (): ConcealedKeyword => ({ kind: 'concealed' });
simple<ConcealedKeyword>('concealed', 'Concealed', 'core',
  'Enemy individual spells cannot target this minion.', 'Concealed', () => ({ stats: () => ({ concealed: true }) }));

export interface PacifiedKeyword extends Keyword { kind: 'pacified' }
export const Pacified = (): PacifiedKeyword => ({ kind: 'pacified' });
simple<PacifiedKeyword>('pacified', 'Pacified', 'core',
  'No longer attacks and deals no hand or missile damage.', 'Pacified',
  () => ({ stats: () => ({ handAttacks: -9, missileAttacks: -9, noDamage: true }) }));

export interface LastsKeyword extends Keyword { kind: 'lasts'; turns: number }
/** Total lifetime in turns, counting the casting turn ("Turn of casting +2" is `Lasts(3)`). */
export const Lasts = (turns: number): LastsKeyword => ({ kind: 'lasts', turns });
defineKeyword<LastsKeyword>({
  kind: 'lasts', term: 'Lasts N', tier: 'core',
  gloss: 'The spell ends after N turns, counting the turn it was cast.',
  print: (k) => ({ layout: 'inline', text: `Lasts ${k.turns} turns` }),
  compile: (k) => ({ duration: { turns: k.turns } }),
});

export interface StackableKeyword extends Keyword { kind: 'stackable' }
export const Stackable = (): StackableKeyword => ({ kind: 'stackable' });
simple<StackableKeyword>('stackable', 'Stackable', 'core',
  'May be cast more than once on the same target; the effects add up.', 'Stackable', () => ({ exclusive: false }));

export interface FleetingKeyword extends Keyword { kind: 'fleeting' }
export const Fleeting = (): FleetingKeyword => ({ kind: 'fleeting' });
simple<FleetingKeyword>('fleeting', 'Fleeting', 'core',
  'Dispelled after the group\'s next combat.', 'Fleeting',
  () => ({ on: { 'combat:after': (c, ev) => { if (isHostGroup(c, ev)) c.dispel(); } } }));

export interface UndispellableKeyword extends Keyword { kind: 'undispellable' }
export const Undispellable = (): UndispellableKeyword => ({ kind: 'undispellable' });
simple<UndispellableKeyword>('undispellable', 'Undispellable', 'core',
  'Not an enchantment: it cannot be dispelled and is not listed on the target.', 'Undispellable', () => ({ visible: false }));

export interface TruceKeyword extends Keyword { kind: 'truce' }
export const Truce = (): TruceKeyword => ({ kind: 'truce' });
simple<TruceKeyword>('truce', 'Truce', 'core',
  'No group enters combat while this lasts (start-of-combat effects are prevented too).', 'Truce',
  () => ({ on: { 'combat:before': (c) => c.cancel() } }));

export interface BoundKeyword extends Keyword { kind: 'bound'; terrain: 'forest' | 'water' | 'mountain' | 'desert' | 'plains' }
export const Bound = (terrain: BoundKeyword['terrain']): BoundKeyword => ({ kind: 'bound', terrain });
defineKeyword<BoundKeyword>({
  kind: 'bound', term: 'Bound', tier: 'house',
  gloss: 'The spell ends when its square stops being that terrain.',
  print: (k) => ({ layout: 'inline', text: `Bound to ${k.terrain}` }),
  compile: (k) => ({ persistent: (q, host) => host.kind === 'square' && q.terrainAt(host.pos) === k.terrain }),
});

export interface FanfareKeyword extends Keyword { kind: 'fanfare'; text: string }
/** Flavour only: prints "Plays <text>." and does nothing. */
export const Fanfare = (text: string): FanfareKeyword => ({ kind: 'fanfare', text });
defineKeyword<FanfareKeyword>({
  kind: 'fanfare', term: 'Fanfare', tier: 'oneoff',
  gloss: 'Flavour only: plays music. No rules effect.',
  print: (k) => ({ layout: 'line', text: `Plays ${k.text}.` }),
  compile: () => ({}),
});

export interface AfterwardKeyword extends Keyword { kind: 'afterward'; card: string }
/** When this spell expires, cast the helper card on the globe. */
export const Afterward = (card: string): AfterwardKeyword => ({ kind: 'afterward', card });
defineKeyword<AfterwardKeyword>({
  kind: 'afterward', term: 'Afterwards', tier: 'oneoff',
  gloss: 'When this spell expires, another spell takes its place on the globe.',
  print: (k) => ({ layout: 'line', text: `Afterwards: ${helperSummary(k.card)}.` }),
  compile: (k) => ({ onExpire: (c) => { c.createSpell(k.card, { kind: 'globe' }); } }),
});
