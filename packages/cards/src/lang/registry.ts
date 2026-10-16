import type { Keyword, KeywordDef } from './types';

const defs = new Map<string, KeywordDef<any>>();

export function defineKeyword<K extends Keyword>(def: KeywordDef<K>): KeywordDef<K> {
  if (defs.has(def.kind)) throw new Error(`duplicate keyword "${def.kind}"`);
  defs.set(def.kind, def);
  return def;
}

export function keywordDef(kind: string): KeywordDef<any> {
  const d = defs.get(kind);
  if (!d) throw new Error(`unknown keyword "${kind}"`);
  return d;
}

export const allKeywordDefs = (): Array<KeywordDef<any>> => [...defs.values()];
