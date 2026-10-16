import { viewStats, type CardIndex, type GameState, type Minion, type Ref, type Structure } from '@sanctum/engine';
import { Face, cap, cardName } from './format';

const at = (p: { x: number; y: number }) => `(${p.x + 1},${p.y + 1})`;

function SpellList({ state, host }: { state: GameState; host: Ref }) {
  const spells = state.spells.filter((sp) => JSON.stringify(sp.host) === JSON.stringify(host));
  if (spells.length === 0) return null;
  return (
    <ul class="spells">
      {spells.map((sp) => (
        <li key={sp.id}>
          <strong>{cardName(sp.cardId)}</strong>
          {sp.visible ? null : <span class="tag">effect</span>}
          {sp.turnsLeft !== null ? <span class="tag">{sp.turnsLeft} turn{sp.turnsLeft === 1 ? '' : 's'} left</span> : null}
          <Face id={sp.cardId} skipTarget />
        </li>
      ))}
    </ul>
  );
}

function MinionTile({ state, cards, m }: { state: GameState; cards: CardIndex; m: Minion }) {
  const st = viewStats(state, cards, m.id);
  const pct = Math.max(0, Math.min(100, (100 * m.hp) / st.maxHp));
  return (
    <div class={`minion owner-${m.owner}`}>
      <div class="minion-head">
        <strong>{m.name}</strong>
        <span class="muted">{[m.nation ? cap(m.nation) : '', m.kind === 'recruit' ? m.cls : 'monster'].filter(Boolean).join(' ')}</span>
      </div>
      <div class="hpbar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
      <div class="statline">
        <span>{m.hp}/{st.maxHp}</span>
        <span>H {st.hand}{st.handAttacks > 1 ? `×${st.handAttacks}` : ''}</span>
        <span>M {st.missile}{st.missileAttacks > 1 ? `×${st.missileAttacks}` : ''}</span>
        <span>A {st.armor}</span>
        <span>L {st.level}</span>
        {st.walks.length ? <span>{st.walks.join(', ')}</span> : null}
      </div>
      <SpellList state={state} host={{ kind: 'minion', id: m.id }} />
    </div>
  );
}

function StructureView({ st }: { st: Structure }) {
  return (
    <section>
      <h3>{cap(st.kind)} {at(st.pos)}</h3>
      <p class="muted">Owner: {cap(st.owner)}{st.manaType ? ` · makes ${cap(st.manaType)}` : ''}</p>
      <p>{st.novices} novice{st.novices === 1 ? '' : 's'} waiting{st.noviceNations?.length ? ` (${st.noviceNations.map(cap).join(', ')})` : ''}</p>
    </section>
  );
}

export function Sidebar({ state, cards, selected, children }: { state: GameState; cards: CardIndex; selected: Ref | null; children?: preact.ComponentChildren }) {
  let body: preact.ComponentChildren = <p class="muted">Select a square, group or structure.</p>;
  if (selected?.kind === 'group') {
    const g = state.groups[selected.id];
    if (g) {
      body = (
        <section>
          <h3>{cap(g.owner)} group {g.pos ? at(g.pos) : '(off the board)'}</h3>
          <p class="muted">{g.kind === 'monster' ? 'Monster group' : 'Recruit group'} · {g.control === 'player' ? 'player controlled' : 'computer controlled'}</p>
          {g.minionIds.map((id) => state.minions[id]).filter(Boolean).map((m) => <MinionTile key={m.id} state={state} cards={cards} m={m} />)}
          <SpellList state={state} host={{ kind: 'group', id: g.id }} />
        </section>
      );
    }
  } else if (selected?.kind === 'structure') {
    const st = state.structures[selected.id];
    if (st) body = <StructureView st={st} />;
  } else if (selected?.kind === 'square') {
    const k = `${selected.pos.x},${selected.pos.y}`;
    body = (
      <section>
        <h3>Square {at(selected.pos)}</h3>
        <p class="muted">{cap(state.terrain[k] ?? 'unknown')}</p>
        <SpellList state={state} host={selected} />
      </section>
    );
  }
  // Actions (training, casting, the orders list) come first so they never scroll out of sight under a long group.
  return <aside class="sidebar">{children}{body}</aside>;
}
