import type { CardDef, HouseId, ManaPool, SpellType } from '@sanctum/engine';
import { keywordDef } from './registry';
import { mergeFragments } from './merge';
import { renderSpec } from './render';
import { TargetBuilder, targetFragment, toTargetSpec } from './target';
import type { CardSpec, CompileCtx, Fragment, HostKind, Keyword, TargetSpec } from './types';

export interface CardInput {
  id: string;
  name: string;
  house: HouseId;
  cost: Partial<ManaPool>;
  type: SpellType;
  helper?: boolean;
  target: TargetSpec | TargetBuilder;
  /** Where the spell sits when it differs from the target ('minion' for summoned creatures). */
  host?: HostKind;
  keywords: Keyword[];
}

const specs = new Map<string, CardSpec>();
const defs = new Map<string, CardDef>();
export const specOf = (id: string): CardSpec | undefined => specs.get(id);
/** The compiled card declared with this id (for reading another card's hooks, e.g. a helper's stats). */
export const defOf = (id: string): CardDef | undefined => defs.get(id);

/** Test-only: forget every declared card so a test can declare the same ids again. */
export function resetCards(): void {
  specs.clear();
  defs.clear();
}

/** Declare a card from keywords. Returns the same `CardDef` the engine already runs. */
export function card(input: CardInput): CardDef {
  if (specs.has(input.id)) throw new Error(`duplicate card id "${input.id}"`);
  const spec: CardSpec = {
    id: input.id, name: input.name, house: input.house, cost: input.cost, type: input.type,
    helper: input.helper, target: toTargetSpec(input.target), host: input.host, keywords: input.keywords,
  };
  const ctxOf = (index: number): CompileCtx => ({
    target: spec.target, type: spec.type, cardId: spec.id, index, house: spec.house, host: spec.host, keywords: spec.keywords,
  });
  const frags: Fragment[] = [targetFragment(spec.target)];
  spec.keywords.forEach((k, i) => frags.push(keywordDef(k.kind).compile(k, ctxOf(i))));
  const merged = mergeFragments(frags);
  spec.keywords.forEach((k, i) => keywordDef(k.kind).validate?.(k, merged, ctxOf(i)));
  if (spec.helper) {
    // ctx.createSpell skips casting rules and onCast, so a helper's would silently never run.
    for (const hook of ['onCast', 'canCast'] as const) {
      if (merged[hook]) throw new Error(`card "${spec.id}": a helper card cannot have ${hook} (createSpell skips it)`);
    }
  }
  specs.set(spec.id, spec);
  const def: CardDef = {
    id: spec.id, name: spec.name, house: spec.house, cost: spec.cost, type: spec.type, target: spec.target.type,
    ...merged,
  };
  if (spec.helper) def.helper = true;
  defs.set(spec.id, def);
  // The printed face, joined by newlines. Lazy: it may name helper cards declared after this one.
  Object.defineProperty(def, 'text', { enumerable: true, configurable: true, get: () => renderSpec(spec).lines.join('\n') });
  return def;
}
