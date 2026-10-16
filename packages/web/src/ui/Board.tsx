import { useEffect, useRef, useState } from 'preact/hooks';
import type { GameState, PlayerId, Pos, Ref } from '@sanctum/engine';
import { diamondPoints, project, TERRAIN_FILL, VIEW } from '../model/geometry';

export interface Arrow {
  from: Pos;
  to: Pos;
  owner: PlayerId;
}

export interface BoardProps {
  state: GameState;
  selected: Ref | null;
  /** Cell keys ("x,y") drawn as legal targets or moves. */
  highlights: Set<string>;
  arrows: Arrow[];
  onCell: (pos: Pos) => void;
  /** A square to scroll into the middle when the board first appears and is wider than its box (phones). */
  centre?: Pos | null;
}

const OWNER_COLOR: Record<PlayerId, string> = { red: 'var(--red)', blue: 'var(--blue)', neutral: '#9aa3ad' };

function selectedKey(state: GameState, sel: Ref | null): string | null {
  if (!sel) return null;
  if (sel.kind === 'square') return `${sel.pos.x},${sel.pos.y}`;
  const pos = sel.kind === 'group' ? state.groups[sel.id]?.pos : sel.kind === 'structure' ? state.structures[sel.id]?.pos : null;
  return pos ? `${pos.x},${pos.y}` : null;
}

/** Keyboard focus only: a mouse click on a tile should not draw the focus ring. */
function focusVisible(el: Element): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What a screen reader hears for a square: "Square (3,4), plains, Red sanctum, Red group of 4". */
export function cellLabel(state: GameState, pos: Pos): string {
  const k = `${pos.x},${pos.y}`;
  const parts = [`Square (${pos.x + 1},${pos.y + 1})`, state.terrain[k] ?? 'unknown'];
  for (const st of Object.values(state.structures)) {
    if (st.pos.x === pos.x && st.pos.y === pos.y) parts.push(`${cap(st.owner)} ${st.kind}`);
  }
  for (const g of Object.values(state.groups)) {
    if (g.pos && g.pos.x === pos.x && g.pos.y === pos.y) {
      parts.push(`${cap(g.owner)} ${g.kind === 'monster' ? 'monster group' : 'group'} of ${g.minionIds.length}`);
    }
  }
  return parts.join(', ');
}

export function Board({ state, selected, highlights, arrows, onCell, centre }: BoardProps) {
  const selKey = selectedKey(state, selected);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  // Centre once, on first draw: re-centring on every pick would shift the board under the player's finger.
  useEffect(() => {
    const w = wrap.current;
    if (!w || !centre || w.scrollWidth <= w.clientWidth) return;
    const c = project(centre);
    w.scrollLeft = ((c.x - VIEW.x) / VIEW.w) * w.scrollWidth - w.clientWidth / 2;
  }, []);
  const cells = state.cells.map((k) => {
    const [x, y] = k.split(',').map(Number);
    return { k, pos: { x, y } };
  });
  return (
    <div class="board-wrap" ref={wrap}>
      <svg class="board" viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} role="group" aria-label="Game board">
        {cells.map(({ k, pos }) => (
          <polygon
            key={k}
            class={`tile${highlights.has(k) ? ' hl' : ''}${selKey === k ? ' selected' : ''}`}
            data-cell={k}
            points={diamondPoints(pos)}
            fill={TERRAIN_FILL[state.terrain[k]]}
            tabindex={0}
            role="button"
            aria-label={`${cellLabel(state, pos)}${selKey === k ? ', selected' : ''}${highlights.has(k) ? ', highlighted' : ''}`}
            onClick={() => onCell(pos)}
            onKeyDown={(e: KeyboardEvent) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              onCell(pos);
            }}
            onFocus={(e: FocusEvent) => setFocusKey(focusVisible(e.currentTarget as Element) ? k : null)}
            onBlur={() => setFocusKey((f) => (f === k ? null : f))}
          />
        ))}
        {/* Outlines drawn after every tile so neighbouring tiles cannot paint over them. */}
        {cells.filter(({ k }) => highlights.has(k) || selKey === k).map(({ k, pos }) => (
          <polygon key={`o${k}`} class={`outline${highlights.has(k) ? ' hl' : ''}${selKey === k ? ' selected' : ''}`}
            points={diamondPoints(pos)} pointer-events="none" />
        ))}
        {/* Keyboard focus ring, drawn on top like the outlines. */}
        {focusKey ? cells.filter(({ k }) => k === focusKey).map(({ k, pos }) => (
          <polygon key={`f${k}`} class="outline focus" points={diamondPoints(pos, 3)} pointer-events="none" />
        )) : null}
        {Object.values(state.structures).map((st) => {
          const c = project(st.pos);
          const glyph = st.kind === 'sanctum' ? 'S' : st.kind === 'town' ? 'T' : 'C';
          // Owner is shown by shape as well as colour: red square corners, blue round corners, neutral dashed.
          const rx = st.owner === 'blue' ? 6 : 1;
          return (
            // In the left corner of its own square, clear of the group token in the middle.
            <g key={`st${st.id}`} class={`structure owner-${st.owner}`} pointer-events="none" transform={`translate(${c.x - 27} ${c.y - 6})`}>
              <rect width="12" height="12" rx={rx} fill="#10151b" stroke={OWNER_COLOR[st.owner]} stroke-width="2"
                stroke-dasharray={st.owner === 'neutral' ? '3 2' : undefined} />
              <text x="6" y="9.5" text-anchor="middle" class="glyph">{glyph}</text>
            </g>
          );
        })}
        {Object.values(state.groups).filter((g) => g.pos).map((g) => {
          const c = project(g.pos!);
          const monster = g.kind === 'monster';
          return (
            <g key={`g${g.id}`} class={`group-token${monster ? ' monster' : ''}`} pointer-events="none" transform={`translate(${c.x} ${c.y})`}>
              {monster
                ? <polygon points="0,-13 12,0 0,13 -12,0" fill={OWNER_COLOR[g.owner]} stroke="#0b0f14" stroke-width="2" />
                : <circle r="12" fill={OWNER_COLOR[g.owner]} stroke="#0b0f14" stroke-width="2" />}
              <text y="5" text-anchor="middle" class="count">{g.minionIds.length}</text>
            </g>
          );
        })}
        {arrows.map((a, i) => {
          // Draw the middle of the centre-to-centre segment so the arrow crosses the shared edge and clears both tokens.
          const a0 = project(a.from);
          const a1 = project(a.to);
          const f = { x: a0.x + (a1.x - a0.x) * 0.3, y: a0.y + (a1.y - a0.y) * 0.3 };
          const t = { x: a0.x + (a1.x - a0.x) * 0.62, y: a0.y + (a1.y - a0.y) * 0.62 };
          return (
            <line key={`a${i}`} class="arrow" pointer-events="none" x1={f.x} y1={f.y} x2={t.x} y2={t.y}
              stroke={OWNER_COLOR[a.owner]} stroke-width="5" stroke-linecap="round" marker-end="url(#head)" />
          );
        })}
        <defs>
          <marker id="head" viewBox="0 0 6 6" markerWidth="2.4" markerHeight="2.4" refX="1" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill="#e4eaf0" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}
