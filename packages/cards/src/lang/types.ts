import type { CardDef, HouseId, ManaPool, SpellType, TargetType, TerrainId } from '@sanctum/engine';

/** What a keyword contributes to a card: any `CardDef` hook except the identity fields. */
export type Fragment = Partial<Omit<CardDef, 'id' | 'name' | 'house' | 'cost' | 'type' | 'target' | 'text'>>;

/** Keywords are plain data: `{ kind: 'grant', ... }`. Constructors in `keywords/*` build them. */
export interface Keyword {
  readonly kind: string;
}

/** `inline` keywords are comma-joined on one line after the target; `line` keywords get their own line. */
export interface PrintedPart {
  layout: 'inline' | 'line';
  text: string;
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
}

export interface CompileCtx {
  target: TargetSpec;
  type: SpellType;
  cardId: string;
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
  /** What this keyword adds to the compiled card. */
  compile(k: K, ctx: CompileCtx): Fragment;
}

export interface CardSpec {
  id: string;
  name: string;
  house: HouseId;
  cost: Partial<ManaPool>;
  type: SpellType;
  helper?: boolean;
  target: TargetSpec;
  keywords: Keyword[];
}
