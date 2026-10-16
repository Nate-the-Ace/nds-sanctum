import { useState } from 'preact/hooks';
import { houseMana, type HouseId, type Mana, type Side } from '@sanctum/engine';
import type { Report } from '../model/report';
import type { Session } from '../model/session';
import { Board } from './Board';
import { cap, manaLabel } from './format';

const HOUSES: Array<'war' | 'life'> = ['war', 'life'];
const MANA: Mana[] = ['clarity', 'mystery', 'order', 'strife', 'will', 'world'];

export function Setup({ onStart, onResume }: { onStart: (seed: number, houses: Record<Side, HouseId>) => void; onResume?: () => void }) {
  const [red, setRed] = useState<'war' | 'life'>('war');
  const [blue, setBlue] = useState<'war' | 'life'>('life');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000));
  return (
    <main class="shell setup">
      <h1>Sanctum</h1>
      <p class="muted">Two players, one screen. Pick a house for each side.</p>
      <div class="setup-grid">
        <label>Red house
          <select value={red} onChange={(e) => setRed((e.target as HTMLSelectElement).value as 'war' | 'life')}>
            {HOUSES.map((h) => <option key={h} value={h}>{cap(h)}</option>)}
          </select>
        </label>
        <label>Blue house
          <select value={blue} onChange={(e) => setBlue((e.target as HTMLSelectElement).value as 'war' | 'life')}>
            {HOUSES.map((h) => <option key={h} value={h}>{cap(h)}</option>)}
          </select>
        </label>
        <label>Seed
          <input type="number" value={seed} onInput={(e) => setSeed(Number((e.target as HTMLInputElement).value))} />
        </label>
      </div>
      <div class="btnrow">
        <button type="button" class="primary" onClick={() => onStart(seed, { red, blue })}>Start game</button>
        {onResume ? <button type="button" onClick={onResume}>Resume game</button> : null}
      </div>
    </main>
  );
}

export function Handoff({ to, turn, onReady }: { to: Side; turn: number; onReady: () => void }) {
  return (
    <main class={`shell handoff side-${to}`}>
      <p class="muted">Turn {turn}</p>
      <h1>Pass the device to {cap(to)}</h1>
      <p class="muted">The other player should look away. Orders stay hidden until you continue.</p>
      <button type="button" class="primary" onClick={onReady}>I'm ready</button>
    </main>
  );
}

export function ManaChoice({ session, side, onPick }: { session: Session; side: Side; onPick: (structureId: number, mana: Mana) => void }) {
  const id = session.state.pendingMana.find((sid) => session.state.structures[sid].owner === side)!;
  const st = session.state.structures[id];
  const house = session.state.players[side].house;
  const uses = houseMana(house).map(manaLabel);
  return (
    <main class={`shell mana-choice side-${side}`}>
      <h1>{cap(side)} captured the {st.kind} at ({st.pos.x + 1},{st.pos.y + 1})</h1>
      <p class="muted">Choose the mana it produces each turn for as long as you hold it.</p>
      <p>{cap(house)} spells use {uses.join(' and ')}.</p>
      <div class="btnrow">
        {MANA.map((m) => <button key={m} type="button" class="primary" onClick={() => onPick(id, m)}>{manaLabel(m)}</button>)}
      </div>
    </main>
  );
}

export function ReportScreen({ session, report, onNext }: { session: Session; report: Report; onNext: () => void }) {
  return (
    <main class="report">
      <header class="topbar">
        <h2>Turn {report.turn} report</h2>
        <button type="button" class="primary" onClick={onNext}>{session.state.phase === 'over' ? 'See the result' : 'Next turn'}</button>
      </header>
      <div class="stage">
        <Board state={session.state} selected={null} highlights={new Set()} onCell={() => {}}
          arrows={report.moves.map((m) => ({ from: m.from, to: m.to, owner: m.owner }))} />
        <aside class="sidebar">
          {report.sections.length === 0 ? <p class="muted">Nothing happened.</p> : null}
          {report.sections.map((sec) => (
            <section key={sec.title}>
              <h3>{sec.title}</h3>
              <ul class="plain">{sec.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
            </section>
          ))}
        </aside>
      </div>
    </main>
  );
}

export function Over({ winner, turn, onNew }: { winner: Side | null; turn: number; onNew: () => void }) {
  const loser = winner === 'red' ? 'blue' : winner === 'blue' ? 'red' : null;
  return (
    <main class={`shell over ${winner ? `side-${winner}` : ''}`}>
      <h1>{winner ? `${cap(winner)} wins` : 'Game over'}</h1>
      <p class="muted">{loser ? `${cap(loser)}'s Sanctum fell on turn ${turn}.` : `The game ended on turn ${turn}.`}</p>
      <button type="button" class="primary" onClick={onNew}>New game</button>
    </main>
  );
}
