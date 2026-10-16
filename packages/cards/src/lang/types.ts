import type { CardDef, HouseId, ManaPool, SpellType, TargetType, TerrainId } from '@sanctum/engine';

/** What a keyword contributes to a card: any `CardDef` hook except the identity fields. */
export type Fragment = Partial<Omit<CardDef, 'id' | 'name' | 'house' | 'cost' | 'type' | 'target' | 'text' | 'copyOf'>>;

export type HostKind = 'group' | 'minion' | 'globe';

/** Keywords are plain data: `{ kind: 'grant', ... }`. Constructors in `keywords/*` build them. */
export interface Keyword {
  readonly kind: string;
}

/**
 * `inline` keywords are comma-joined on one line after the target; `line` keywords get their own line.
 * `section` places a line on the face: created creatures, then statics, then triggers, then cast effects (default
 * `static`).
 */
export interface PrintedPart {
  layout: 'inline' | 'line';
  text: string;
  section?: 'creature' | 'static' | 'trigger' | 'effect';
}

export interface TargetSpec {
  type: TargetType;
  friendly?: boolean;
  nonFriendly?: boolean;
  /** Minion class (recruit targets) or "group contains this class" (group targets). */
  cls?: 'swordsman' | 'archer';
  /** The minion must be alone in its group. */
  alone?: boolean;
  /** Square terrain required (square targets). */
  terrain?: TerrainId[];
  /** Group or single-minion targets: the target's square must have one of these terrains. */
  in?: TerrainId[];
}

export interface CompileCtx {
  target: TargetSpec;
  type: SpellType;
  cardId: string;
  /** This keyword's position in the card's keyword list; prefix spell token names with it to avoid collisions. */
  index: number;
  house: HouseId;
  /** Where the spell sits when it differs from the target: summoned creatures carry it on their minions. */
  host?: HostKind;
  /** Every keyword on the card (this one is `keywords[index]`). */
  keywords: readonly Keyword[];
}

export interface KeywordDef<K extends Keyword = Keyword> {
  kind: K['kind'];
  /** Display name in the glossary. */
  term: string;
  /** core = learn first; house = per-house mechanic; oneoff = single-card rules. */
  tier: 'core' | 'house' | 'oneoff';
  /** Reminder text for the glossary and tooltips. */
  gloss: string;
  /** Printed form, or null to print nothing. */
  print(k: K): PrintedPart | null;
  /** What this keyword adds to the compiled card. Throw here to reject a keyword the target cannot host. */
  compile(k: K, ctx: CompileCtx): Fragment;
  /** Checks against the whole merged card (e.g. "needs a duration"). Throw to reject the card. */
  validate?(k: K, merged: Fragment, ctx: CompileCtx): void;
}

export interface CardSpec {
  id: string;
  name: string;
  house: HouseId;
  cost: Partial<ManaPool>;
  type: SpellType;
  helper?: boolean;
  /** A recursive hand copy of this card id. */
  copyOf?: string;
  target: TargetSpec;
  host?: HostKind;
  keywords: Keyword[];
}
