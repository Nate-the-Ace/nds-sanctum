import type { CardDef, HouseId, ManaPool, SpellType } from '@sanctum/engine';
import { keywordDef } from './registry';
import { mergeFragments } from './merge';
import { TargetBuilder, targetFragment, toTargetSpec } from './target';
import type { CardSpec, Fragment, Keyword, TargetSpec } from './types';

export interface CardInput {
  id: string;
  name: string;
  house: HouseId;
  cost: Partial<ManaPool>;
  type: SpellType;
  helper?: boolean;
  target: TargetSpec | TargetBuilder;
  keywords: Keyword[];
}

const specs = new Map<string, CardSpec>();
export const specOf = (id: string): CardSpec | undefined => specs.get(id);

/** Declare a card from keywords. Returns the same `CardDef` the engine already runs. */
export function card(input: CardInput): CardDef {
  const spec: CardSpec = {
    id: input.id, name: input.name, house: input.house, cost: input.cost, type: input.type,
    helper: input.helper, target: toTargetSpec(input.target), keywords: input.keywords,
  };
  const frags: Fragment[] = [targetFragment(spec.target)];
  for (const k of spec.keywords) {
    frags.push(keywordDef(k.kind).compile(k, { target: spec.target, type: spec.type, cardId: spec.id }));
  }
  specs.set(spec.id, spec);
  const def: CardDef = {
    id: spec.id, name: spec.name, house: spec.house, cost: spec.cost, type: spec.type, target: spec.target.type,
    ...mergeFragments(frags),
  };
  if (spec.helper) def.helper = true;
  return def;
}
