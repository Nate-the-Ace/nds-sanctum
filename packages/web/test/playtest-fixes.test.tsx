import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptyOrders, type Orders } from '@sanctum/engine';
import { OrdersScreen } from '../src/ui/OrdersScreen';
import { ManaChoice, Over, ReportScreen } from '../src/ui/Screens';
import { Board } from '../src/ui/Board';
import { project } from '../src/model/geometry';
import { afterReport, begin, lock, newSession } from '../src/model/session';

const setup = () => {
  const s = begin(newSession(7, { red: 'war', blue: 'life' }), 'red');
  const onLock = vi.fn<(o: Orders) => string | null>(() => null);
  const view = render(<OrdersScreen session={s} side="red" onLock={onLock} />);
  const cell = (x: number, y: number) => view.container.querySelector(`polygon[data-cell="${x},${y}"]`)!;
  return { s, view, cell };
};

describe('playtest fixes', () => {
  afterEach(cleanup);

  it('refuses a second mana training in the same turn with the engine text', () => {
    const { s, view, cell } = setup();
    const st = Object.values(s.state.structures).find((x) => x.kind === 'sanctum' && x.owner === 'red')!;
    fireEvent.click(cell(st.pos.x, st.pos.y));
    fireEvent.click(screen.getByRole('button', { name: /Train as Strife mana/ }));
    fireEvent.click(screen.getByRole('button', { name: /Train as Clarity mana/ }));
    expect(screen.getByRole('alert').textContent).toMatch(/one novice can be trained as mana/);
    const list = view.container.querySelector('.orders-list') as HTMLElement;
    expect(within(list).queryByText(/Clarity/)).toBeNull();
    expect(within(list).getByText(/Strife/)).toBeTruthy();
  });

  it('names a move by its squares, not a compass letter', () => {
    const { s, view, cell } = setup();
    const g = Object.values(s.state.groups).find((x) => x.owner === 'red')!;
    fireEvent.click(cell(g.pos!.x, g.pos!.y));
    fireEvent.click(view.container.querySelector('polygon.tile.hl')!);
    const list = view.container.querySelector('.orders-list') as HTMLElement;
    expect(list.textContent).toMatch(/Move group \(\d+,\d+\) to \(\d+,\d+\)/);
  });

  it('the mana choice says where the structure is and which mana the house uses', () => {
    let s = newSession(7, { red: 'war', blue: 'life' });
    const town = Object.values(s.state.structures).find((x) => x.kind === 'town')!;
    Object.values(s.state.groups).find((g) => g.owner === 'red')!.pos = { ...town.pos };
    let r = lock(begin(s, 'red'), 'red', emptyOrders());
    if (!r.ok) throw new Error(r.error);
    r = lock(begin(r.session, 'blue'), 'blue', emptyOrders());
    if (!r.ok) throw new Error(r.error);
    s = afterReport(r.session);
    render(<ManaChoice session={s} side="red" onPick={() => {}} />);
    expect(screen.getByRole('heading', { name: `Red captured the town at (${town.pos.x + 1},${town.pos.y + 1})` })).toBeTruthy();
    expect(screen.getByText(/War spells use Strife and Clarity/)).toBeTruthy();
  });

  it('draws a structure glyph wholly inside its own square', () => {
    const s = newSession(7, { red: 'war', blue: 'life' });
    const { container } = render(<Board state={s.state} selected={null} highlights={new Set()} arrows={[]} onCell={() => {}} />);
    const sts = Object.values(s.state.structures);
    container.querySelectorAll('g.structure').forEach((g, i) => {
      const c = project(sts[i].pos);
      const [tx, ty] = (g.getAttribute('transform') ?? '').match(/-?[\d.]+/g)!.map(Number);
      const rect = g.querySelector('rect')!;
      const w = Number(rect.getAttribute('width'));
      const h = Number(rect.getAttribute('height'));
      // every corner of the glyph box lies inside the diamond |dx|/40 + |dy|/20 <= 1
      for (const [x, y] of [[tx, ty], [tx + w, ty], [tx, ty + h], [tx + w, ty + h]]) {
        expect(Math.abs(x - c.x) / 40 + Math.abs(y - c.y) / 20).toBeLessThanOrEqual(1);
      }
    });
  });

  it('the last report of a finished game leads to the result, not a next turn', () => {
    let s = newSession(7, { red: 'war', blue: 'life' });
    const sanctum = Object.values(s.state.structures).find((x) => x.kind === 'sanctum' && x.owner === 'red')!;
    Object.values(s.state.groups).find((g) => g.owner === 'blue')!.pos = { ...sanctum.pos };
    Object.values(s.state.groups).find((g) => g.owner === 'red')!.pos = { x: sanctum.pos.x + 3, y: sanctum.pos.y + 3 };
    let r = lock(begin(s, 'red'), 'red', emptyOrders());
    if (!r.ok) throw new Error(r.error);
    r = lock(begin(r.session, 'blue'), 'blue', emptyOrders());
    if (!r.ok) throw new Error(r.error);
    s = r.session;
    expect(s.state.phase).toBe('over');
    render(<ReportScreen session={s} report={s.report!} onNext={() => {}} />);
    expect(screen.queryByRole('button', { name: /Next turn/ })).toBeNull();
    expect(screen.getByRole('button', { name: /See the result/ })).toBeTruthy();
  });

  it('the end screen names the fallen Sanctum and the turn', () => {
    render(<Over winner="blue" turn={13} onNew={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Blue wins' })).toBeTruthy();
    expect(screen.getByText(/Red's Sanctum fell on turn 13/)).toBeTruthy();
  });

  it('clicking the selected group again clears the selection, so a neighbouring structure can be picked', () => {
    const { s, view, cell } = setup();
    const g = Object.values(s.state.groups).find((x) => x.owner === 'red')!;
    fireEvent.click(cell(g.pos!.x, g.pos!.y));
    expect(view.container.querySelectorAll('polygon.tile.hl').length).toBeGreaterThan(0);
    fireEvent.click(cell(g.pos!.x, g.pos!.y));
    expect(view.container.querySelectorAll('polygon.tile.hl')).toHaveLength(0);
    expect(screen.getByText(/Select a square, group or structure/)).toBeTruthy();
  });

  it('labels the pool as the mana for this turn', () => {
    setup();
    expect(screen.getByText(/Mana this turn/)).toBeTruthy();
  });
});
