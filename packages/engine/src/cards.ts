import type { BotContext, EventContext, QueryContext } from './ctx';
import type { EventType, GameEvent } from './events';
import type { StatDelta } from './stats';
import type { ActiveSpell, Dir, HouseId, ManaPool, PlayerId, Pos, Ref } from './types';

export type SpellType = 'alteration' | 'conjuration' | 'manifestation' | 'summoning' | 'hero';
export type TargetType =
  | 'recruit' | 'monster' | 'minion'
  | 'recruitGroup' | 'monsterGroup' | 'group'
  | 'square' | 'structure' | 'globe';

/** A cast being attempted, as seen by `blocksCast`. */
export interface CastAttempt {
  caster: PlayerId;
  card: CardDef;
  target: Ref;
}

export interface CardDef {
  id: string;
  name: string;
  house: HouseId;
  cost: Partial<ManaPool>;
  type: SpellType;
  target: TargetType;
  text?: string;
  /** Alterations/conjurations are visible (dispellable, exclusive) unless this is false. */
  visible?: boolean;
  exclusive?: boolean;
  /** Individual spells normally cannot target enemy minions concealed in forest. */
  ignoresConcealment?: boolean;
  /** Engine-cast helper spell: created by other cards through `ctx.createSpell`, never played from a deck. */
  helper?: boolean;
  /** A recursive hand copy of that card (more tokens): never in a deck, and exclusive together with the original. */
  copyOf?: string;
  /** Conjuration lifetime. Counts the casting turn: `{ turns: 1 }` expires at the end of the turn it is cast. */
  duration?: { turns: number };
  /** Casting-time requirement. Checked while ordering and again just before execution. */
  canCast?: (q: QueryContext, target: Ref) => boolean;
  /** Persistent requirement. Rechecked after spell/structure flux; failure dispels the spell. */
  persistent?: (q: QueryContext, host: Ref) => boolean;
  /** Computed stat contribution for a minion this spell reaches (host minion, group, square, structure or globe). */
  stats?: (q: QueryContext, minionId: number, spell: ActiveSpell) => StatDelta;
  /** On a minion-hosted spell: `stats` also applies to every other minion in the host minion's group. */
  groupAura?: boolean;
  /** 'board': `stats` is asked about every minion on the board (the hook decides who gets what), e.g. General. */
  reach?: 'board';
  /** While this spell is active, return true to forbid the attempted cast (it squanders, or is rejected while ordering). */
  blocksCast?: (q: QueryContext, spell: ActiveSpell, attempt: CastAttempt) => boolean;
  /**
   * While active, return true to stop group `groupId` from entering square `dest` (movement, bot steps, orders,
   * `ctx.canEnter`). Returning from off the board and relocation are not entering.
   */
  blocksEntry?: (q: QueryContext, spell: ActiveSpell, groupId: number, dest: Pos) => boolean;
  /** Runs when a spell of this card expires by duration, just before it is removed (not when dispelled). */
  onExpire?: (c: EventContext) => void;
  /** Runs when the spell executes successfully. */
  onCast?: (c: EventContext, target: Ref) => void;
  /** Event handlers, keyed by event type. */
  on?: Partial<Record<EventType, (c: EventContext, ev: GameEvent) => void>>;
  /** Movement AI for computer-controlled groups this card summons. Return null to stand still. */
  bot?: (q: BotContext, groupId: number) => Dir | null;
}

export type CardIndex = Record<string, CardDef>;

export function defineCard(def: CardDef): CardDef {
  return def;
}

export function indexCards(defs: CardDef[]): CardIndex {
  const out: CardIndex = {};
  for (const d of defs) {
    if (out[d.id]) throw new Error(`duplicate card id ${d.id}`);
    out[d.id] = d;
  }
  return out;
}
