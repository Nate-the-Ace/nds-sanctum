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
}

const OWNER_COLOR: Record<PlayerId, string> = { red: 'var(--red)', blue: 'var(--blue)', neutral: '#9aa3ad' };

function selectedKey(state: GameState, sel: Ref | null): string | null {
  if (!sel) return null;
  if (sel.kind === 'square') return `${sel.pos.x},${sel.pos.y}`;
  const pos = sel.kind === 'group' ? state.groups[sel.id]?.pos : sel.kind === 'structure' ? state.structures[sel.id]?.pos : null;
  return pos ? `${pos.x},${pos.y}` : null;
}

export function Board({ state, selected, highlights, arrows, onCell }: BoardProps) {
  const selKey = selectedKey(state, selected);
  const cells = state.cells.map((k) => {
    const [x, y] = k.split(',').map(Number);
    return { k, pos: { x, y } };
  });
  return (
    <svg class="board" viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} role="group" aria-label="Game board">
      {cells.map(({ k, pos }) => (
        <polygon
          key={k}
          class={`tile${highlights.has(k) ? ' hl' : ''}${selKey === k ? ' selected' : ''}`}
          data-cell={k}
          points={diamondPoints(pos)}
          fill={TERRAIN_FILL[state.terrain[k]]}
          onClick={() => onCell(pos)}
        />
      ))}
      {/* Outlines drawn after every tile so neighbouring tiles cannot paint over them. */}
      {cells.filter(({ k }) => highlights.has(k) || selKey === k).map(({ k, pos }) => (
        <polygon key={`o${k}`} class={`outline${highlights.has(k) ? ' hl' : ''}${selKey === k ? ' selected' : ''}`}
          points={diamondPoints(pos)} pointer-events="none" />
      ))}
      {Object.values(state.structures).map((st) => {
        const c = project(st.pos);
        const glyph = st.kind === 'sanctum' ? 'S' : st.kind === 'town' ? 'T' : 'C';
        return (
          <g key={`st${st.id}`} class="structure" pointer-events="none" transform={`translate(${c.x - 20} ${c.y + 2})`}>
            <rect width="14" height="14" rx="2" fill="#10151b" stroke={OWNER_COLOR[st.owner]} stroke-width="2" />
            <text x="7" y="11" text-anchor="middle" class="glyph">{glyph}</text>
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
  );
}
