import { specOf } from './card';
import { VERBS } from './effects';
import { allKeywordDefs, keywordDef } from './registry';
import { printTarget } from './target';
import type { CardSpec } from './types';

export interface Face {
  id: string;
  name: string;
  lines: string[];
}

const SECTIONS = ['static', 'trigger', 'effect'] as const;

/**
 * The design template: target line; statics (inline keywords comma-joined, then static lines); triggers; cast
 * effects. Within a section, lines keep declaration order.
 */
export function renderSpec(spec: CardSpec): Face {
  const inline: string[] = [];
  const lines: Record<(typeof SECTIONS)[number], string[]> = { static: [], trigger: [], effect: [] };
  for (const k of spec.keywords) {
    const part = keywordDef(k.kind).print(k);
    if (!part) continue;
    if (part.layout === 'inline') inline.push(part.text);
    else lines[part.section ?? 'static'].push(part.text);
  }
  const out = [printTarget(spec.target)];
  if (inline.length) out.push(`${inline.join(', ')}.`);
  for (const s of SECTIONS) out.push(...lines[s]);
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

const isVerb = (e: GlossaryEntry) => (e.kind.startsWith('verb:') ? 1 : 0);

/** Keywords and effect verbs (kind `verb:<name>`, tier core). Ordered by tier, keywords before verbs, then term. */
export function glossary(): GlossaryEntry[] {
  const keywords = allKeywordDefs().map((d) => ({ kind: d.kind, term: d.term, tier: d.tier, gloss: d.gloss }));
  const verbs = Object.entries(VERBS).map(([kind, v]) => ({ kind: `verb:${kind}`, term: v.term, tier: 'core' as const, gloss: v.gloss }));
  return [...keywords, ...verbs].sort(
    (a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || isVerb(a) - isVerb(b) || a.term.localeCompare(b.term),
  );
}
