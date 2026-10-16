import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cardIndex } from '@sanctum/cards';
import type { CardIndex, Orders } from '@sanctum/engine';
import { App } from '../src/app';
import { Board } from '../src/ui/Board';
import { HandTray } from '../src/ui/HandTray';
import { OrdersScreen } from '../src/ui/OrdersScreen';
import { Sidebar } from '../src/ui/Sidebar';
import { begin, newSession } from '../src/model/session';

const click = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

describe('review fixes: app', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('keeps a draft when switching to the Cards tab and back', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/Mode/), { target: { value: 'hotseat' } });
    click(/Start game/);
    click(/I'm ready/);
    const discard = screen.getAllByRole('button', { name: /^Discard / })[0];
    fireEvent.click(discard);
    const list = () => document.querySelector('.orders-list') as HTMLElement;
    expect(within(list()).getByText(/^Discard /)).toBeTruthy();
    click(/^Cards$/);
    expect(screen.getByRole('heading', { name: /Card browser/ })).toBeTruthy();
    click(/^Play$/);
    expect(within(list()).getByText(/^Discard /)).toBeTruthy();
  });

  it('offers to resume a game saved at the last safe point', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/Mode/), { target: { value: 'hotseat' } });
    click(/Start game/);
    expect(screen.getByText(/Pass the device to Red/)).toBeTruthy();
    cleanup();
    render(<App />);
    click(/Resume game/);
    expect(screen.getByText(/Pass the device to Red/)).toBeTruthy();
  });

  it('does not save between red locking and blue locking', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/Mode/), { target: { value: 'hotseat' } });
    click(/Start game/);
    const saved = localStorage.getItem('sanctum.save');
    click(/I'm ready/);
    click(/Lock orders/);
    expect(screen.getByText(/Pass the device to Blue/)).toBeTruthy();
    expect(localStorage.getItem('sanctum.save')).toBe(saved);
  });
});

describe('review fixes: board keyboard', () => {
  afterEach(cleanup);
  const s = newSession(7, { red: 'war', blue: 'life' });

  it('tiles are focusable buttons with a descriptive label and respond to Enter and Space', () => {
    const onCell = vi.fn();
    const { container } = render(<Board state={s.state} selected={null} highlights={new Set()} arrows={[]} onCell={onCell} />);
    const g = Object.values(s.state.groups).find((x) => x.owner === 'red')!;
    const tile = container.querySelector(`polygon[data-cell="${g.pos!.x},${g.pos!.y}"]`)!;
    expect(tile.getAttribute('tabindex')).toBe('0');
    expect(tile.getAttribute('role')).toBe('button');
    expect(tile.getAttribute('aria-label')).toMatch(new RegExp(`^Square \\(${g.pos!.x + 1},${g.pos!.y + 1}\\), \\w+, .*Red group of ${g.minionIds.length}`));
    fireEvent.keyDown(tile, { key: 'Enter' });
    fireEvent.keyDown(tile, { key: ' ' });
    fireEvent.keyDown(tile, { key: 'a' });
    expect(onCell).toHaveBeenCalledTimes(2);
    expect(onCell).toHaveBeenCalledWith(g.pos);
  });

  it('names the structure owner in the tile label, not only by colour', () => {
    const { container } = render(<Board state={s.state} selected={null} highlights={new Set()} arrows={[]} onCell={() => {}} />);
    const st = Object.values(s.state.structures).find((x) => x.kind === 'sanctum' && x.owner === 'blue')!;
    expect(container.querySelector(`polygon[data-cell="${st.pos.x},${st.pos.y}"]`)!.getAttribute('aria-label')).toMatch(/Blue sanctum/);
    const g = container.querySelector('g.structure.owner-blue');
    expect(g).toBeTruthy();
  });

  it('wraps the board in its own scroll container', () => {
    const { container } = render(<Board state={s.state} selected={null} highlights={new Set()} arrows={[]} onCell={() => {}} />);
    expect(container.querySelector('.board-wrap > svg.board')).toBeTruthy();
  });
});

const ordersSetup = (cards?: CardIndex, tweak?: (s: ReturnType<typeof begin>) => void) => {
  const s = clone(begin(newSession(7, { red: 'war', blue: 'war' }), 'red'));
  s.cards = cards ?? cardIndex;
  tweak?.(s);
  const onLock = vi.fn<(o: Orders) => string | null>(() => null);
  const view = render(<OrdersScreen session={s} side="red" onLock={onLock} />);
  const cell = (x: number, y: number) => view.container.querySelector(`polygon[data-cell="${x},${y}"]`)!;
  const group = Object.values(s.state.groups).find((g) => g.owner === 'red')!;
  return { s, view, cell, group };
};

describe('review fixes: orders', () => {
  afterEach(cleanup);

  it('an unaffordable queued cast does not block moves', () => {
    const { s, view, cell, group } = ordersSetup();
    const idx = s.state.players.red.hand.indexOf('rain-of-arrows');
    fireEvent.click(screen.getAllByRole('button', { name: /^Play / })[idx]);
    fireEvent.click(cell(group.pos!.x, group.pos!.y));
    expect(screen.getByRole('alert').textContent).toMatch(/not enough/);
    fireEvent.click(cell(group.pos!.x, group.pos!.y));
    const hl = view.container.querySelectorAll('polygon.tile.hl');
    expect(hl.length).toBeGreaterThan(0);
    fireEvent.click(hl[0]);
    expect(view.container.querySelectorAll('line.arrow')).toHaveLength(1);
    expect((view.container.querySelector('.orders-list') as HTMLElement).textContent).toMatch(/Move group/);
  });

  it('offers the globe only when the globe is a legal target', () => {
    const blocked: CardIndex = { ...cardIndex, 'court-politics': { ...cardIndex['court-politics'], canCast: () => false } };
    ordersSetup(blocked, (s) => { s.state.players.red.hand[0] = 'court-politics'; });
    fireEvent.click(screen.getAllByRole('button', { name: /^Play / })[0]);
    expect(screen.queryByRole('button', { name: /Cast on the globe/ })).toBeNull();
    expect(screen.getByText(/No legal target right now/)).toBeTruthy();
    cleanup();
    ordersSetup(undefined, (s) => { s.state.players.red.hand[0] = 'court-politics'; });
    fireEvent.click(screen.getAllByRole('button', { name: /^Play / })[0]);
    expect(screen.getByRole('button', { name: /Cast on the globe/ })).toBeTruthy();
  });

  it('moving onto your own group keeps the merge order but offers to select that group instead', () => {
    let otherId = 0;
    const { view, cell, group, s } = ordersSetup(undefined, (st) => {
      const g = Object.values(st.state.groups).find((x) => x.owner === 'red')!;
      // Split the red group in two, side by side.
      otherId = 9000;
      const moved = g.minionIds.splice(2);
      st.state.groups[otherId] = { ...clone(g), id: otherId, minionIds: moved, pos: { x: g.pos!.x + 1, y: g.pos!.y } };
      for (const id of moved) st.state.minions[id].groupId = otherId;
      st.state.groupSeq.red.push(otherId);
    });
    const other = s.state.groups[otherId];
    fireEvent.click(cell(group.pos!.x, group.pos!.y));
    fireEvent.click(cell(other.pos!.x, other.pos!.y));
    expect(view.container.querySelectorAll('line.arrow')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Select .*Red group.* instead/ }));
    expect(view.container.querySelectorAll('line.arrow')).toHaveLength(0);
    expect(screen.getByRole('heading', { name: new RegExp(`Red group \\(${other.pos!.x + 1},${other.pos!.y + 1}\\)`) })).toBeTruthy();
  });
});

describe('review fixes: hand and sidebar', () => {
  afterEach(cleanup);
  const s = newSession(7, { red: 'war', blue: 'war' });
  const hand = s.state.players.red.hand;

  it('hand button names follow the visible state and the state has a text badge', () => {
    const draft: Orders = { move: [], train: [], cast: [{ handIndex: 1, target: { kind: 'globe' } }], discard: 2 };
    render(<HandTray hand={hand} cards={s.cards} draft={draft} armed={0} onArm={() => {}} onDiscard={() => {}} />);
    const name = (i: number) => s.cards[hand[i]].name;
    expect(screen.getByRole('button', { name: `Cancel ${name(0)}` })).toBeTruthy();
    expect(screen.getByRole('button', { name: `Retarget ${name(1)}` })).toBeTruthy();
    expect(screen.getByRole('button', { name: `Keep ${name(2)}` })).toBeTruthy();
    const cards = document.querySelectorAll('.hand-card');
    expect(cards[0].querySelector('.badge')!.textContent).toMatch(/Choosing target/);
    expect(cards[1].querySelector('.badge')!.textContent).toMatch(/Queued/);
    expect(cards[2].querySelector('.badge')!.textContent).toMatch(/Discarding/);
    expect(cards[3].querySelector('.badge')).toBeNull();
  });

  it('a Sanctum shows the mana its trained novices make each turn', () => {
    const e = clone(s.state);
    const st = Object.values(e.structures).find((x) => x.kind === 'sanctum' && x.owner === 'red')!;
    st.manaTrained = { strife: 2, clarity: 1 };
    render(<Sidebar state={e} cards={s.cards} selected={{ kind: 'structure', id: st.id }} />);
    expect(screen.getByText(/Makes 2 Strife and 1 Clarity each turn/)).toBeTruthy();
  });

  it('hides non-visible helper spells without printed effect, and never shows internal ids', () => {
    const e = clone(s.state);
    const g = Object.values(e.groups).find((x) => x.owner === 'red')!;
    const host = { kind: 'group' as const, id: g.id };
    e.spells.push({ id: 9001, cardId: 'no-such-helper', owner: 'red', host, visible: false, turnsLeft: null, tokens: {} });
    e.spells.push({ id: 9002, cardId: 'swashbuckler', owner: 'red', host, visible: false, turnsLeft: null, tokens: {} });
    const { container } = render(<Sidebar state={e} cards={s.cards} selected={host} />);
    expect(container.textContent).not.toMatch(/no-such-helper/);
    const items = container.querySelectorAll('ul.spells > li');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).not.toMatch(/swashbuckler/);
    expect(items[0].querySelector('.face')).toBeTruthy();
  });
});
