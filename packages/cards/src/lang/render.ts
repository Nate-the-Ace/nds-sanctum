import { specOf } from './card';
import { allKeywordDefs, keywordDef } from './registry';
import { printTarget } from './target';
import type { CardSpec } from './types';

export interface Face {
  id: string;
  name: string;
  lines: string[];
}

/** Target line, then inline keywords comma-joined, then line keywords in declaration order. */
export function renderSpec(spec: CardSpec): Face {
  const inline: string[] = [];
  const lines: string[] = [];
  for (const k of spec.keywords) {
    const part = keywordDef(k.kind).print(k);
    if (!part) continue;
    (part.layout === 'inline' ? inline : lines).push(part.text);
  }
  const out = [printTarget(spec.target)];
  if (inline.length) out.push(`${inline.join(', ')}.`);
  out.push(...lines);
  return { id: spec.id, name: spec.name, lines: out };
}

export function faceOf(id: string): Face | undefined {
  const spec = specOf(id);
  return spec ? renderSpec(spec) : undefined;
}

/** "Thermite Damage (-1 A)": a helper spell's name and its text, for use inside another card's text. */
export function helperSummary(id: string): string {
  const spec = specOf(id);
  if (!spec) return id;
  const body = renderSpec(spec).lines.slice(1).map((l) => l.replace(/\.$/, '')).join('; ');
  return body ? `${spec.name} (${body})` : spec.name;
}

export interface GlossaryEntry {
  kind: string;
  term: string;
  tier: 'core' | 'house' | 'oneoff';
  gloss: string;
}

const TIER_ORDER = { core: 0, house: 1, oneoff: 2 } as const;

export function glossary(): GlossaryEntry[] {
  return allKeywordDefs()
    .map((d) => ({ kind: d.kind, term: d.term, tier: d.tier, gloss: d.gloss }))
    .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || a.term.localeCompare(b.term));
}
