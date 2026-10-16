import { cardFace, cardIndex } from '@sanctum/cards';
import type { ManaPool } from '@sanctum/engine';

const MANA_LABEL: Record<string, string> = { clarity: 'Clarity', mystery: 'Mystery', order: 'Order', strife: 'Strife', will: 'Will', world: 'World' };
export const manaLabel = (m: string) => MANA_LABEL[m] ?? m;
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A cost or pool as chips ("2 Strife"). Zero entries are hidden. */
export function ManaChips({ cost }: { cost: Partial<ManaPool> }) {
  const entries = Object.entries(cost).filter(([, n]) => (n as number) !== 0);
  if (entries.length === 0) return <span class="chip free">free</span>;
  return (
    <span class="chips">
      {entries.map(([m, n]) => (
        <span key={m} class={`chip mana-${m}${(n as number) < 0 ? ' neg' : ''}`}>{n as number} {manaLabel(m)}</span>
      ))}
    </span>
  );
}

/** A card's keyword text: the target line dimmed, then one paragraph per line. */
export function Face({ id, skipTarget = false }: { id: string; skipTarget?: boolean }) {
  const face = cardFace(id);
  if (!face) return null;
  const lines = skipTarget ? face.lines.slice(1) : face.lines;
  return (
    <div class="face">
      {lines.map((l, i) => <p key={i} class={!skipTarget && i === 0 ? 'target' : ''}>{l}</p>)}
    </div>
  );
}

export const cardName = (id: string) => cardIndex[id]?.name ?? id;
