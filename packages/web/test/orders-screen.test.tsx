import { cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { legalTargets, type Orders } from '@sanctum/engine';
import { OrdersScreen } from '../src/ui/OrdersScreen';
import { begin, newSession } from '../src/model/session';

const RED_HAND = ['berserker-blade', 'rain-of-arrows', 'warlord', 'swashbuckler', 'bloodlust'];

const setup = () => {
  const s = begin(newSession(7, { red: 'war', blue: 'war' }), 'red');
  // Pinned: the starter decks grow with every new card, which reshuffles seed 7's opening hand.
  s.state.players.red.hand = [...RED_HAND];
  const onLock = vi.fn<(o: Orders) => string | null>(() => null);
  const view = render(<OrdersScreen session={s} side="red" onLock={onLock} />);
  const group = Object.values(s.state.groups).find((g) => g.owner === 'red')!;
  const cell = (x: number, y: number) => view.container.querySelector(`polygon[data-cell="${x},${y}"]`)!;
  return { s, onLock, view, group, cell };
};

describe('OrdersScreen', () => {
  afterEach(cleanup);

  it('sets and clears a move order by clicking a neighbouring square', () => {
    const { group, cell, view } = setup();
    fireEvent.click(cell(group.pos!.x, group.pos!.y));
    expect(screen.getByText(/Red group/)).toBeTruthy();
    const target = view.container.querySelector('polygon.tile.hl')!;
    expect(target).toBeTruthy();
    fireEvent.click(target);
    expect(view.container.querySelectorAll('line.arrow')).toHaveLength(1);
    expect(screen.getByText(/Move group/)).toBeTruthy();
    fireEvent.click(view.container.querySelector('polygon.tile.hl')!);
    expect(view.container.querySelectorAll('line.arrow')).toHaveLength(0);
  });

  it('trains a recruit at the Sanctum and lists it', () => {
    const { s, view } = setup();
    const st = Object.values(s.state.structures).find((x) => x.kind === 'sanctum' && x.owner === 'red')!;
    fireEvent.click(view.container.querySelector(`polygon[data-cell="${st.pos.x},${st.pos.y}"]`)!);
    fireEvent.click(screen.getByRole('button', { name: /Train swordsman/ }));
    expect(screen.getByText(/Train swordsman/, { selector: '.orders-list *' })).toBeTruthy();
  });

  // Seed 7, war vs war, red's hand pinned to berserker-blade, rain-of-arrows, warlord, swashbuckler, bloodlust (no globe card).
  it('arms a group-target card, highlights its targets and queues the cast', () => {
    const { s, view, group } = setup();
    const hand = s.state.players.red.hand;
    const idx = hand.indexOf('rain-of-arrows');
    expect(s.cards[hand[idx]].target).toBe('recruitGroup');
    fireEvent.click(screen.getAllByRole('button', { name: /^Play / })[idx]);
    const hl = view.container.querySelectorAll('polygon.tile.hl');
    expect(hl.length).toBeGreaterThan(0);
    expect(view.container.querySelector(`polygon.tile.hl[data-cell="${group.pos!.x},${group.pos!.y}"]`)).toBeTruthy();
    fireEvent.click(view.container.querySelector(`polygon[data-cell="${group.pos!.x},${group.pos!.y}"]`)!);
    const list = view.container.querySelector('.orders-list') as HTMLElement;
    expect(within(list).getByText(/Cast Rain of Arrows/)).toBeTruthy();
    expect(view.container.querySelectorAll('polygon.tile.hl')).toHaveLength(0);
  });

  it('offers a list when several targets share a square', () => {
    const { s, view, group } = setup();
    const hand = s.state.players.red.hand;
    const idx = hand.indexOf('berserker-blade');
    expect(s.cards[hand[idx]].target).toBe('recruit');
    fireEvent.click(screen.getAllByRole('button', { name: /^Play / })[idx]);
    fireEvent.click(view.container.querySelector(`polygon[data-cell="${group.pos!.x},${group.pos!.y}"]`)!);
    const options = view.container.querySelectorAll('.choices button');
    const legal = legalTargets(s.state, s.cards, 'red', 'berserker-blade').filter((t) => t.kind === 'minion' && s.state.minions[t.id].groupId === group.id);
    expect(legal.length).toBeGreaterThan(1);
    expect(options.length).toBe(legal.length);
    const labels = [...options].map((o) => o.textContent);
    expect(new Set(labels).size).toBe(labels.length);
    fireEvent.click(options[0]);
    const list = view.container.querySelector('.orders-list') as HTMLElement;
    expect(within(list).getByText(/Cast Berserker Blade/)).toBeTruthy();
  });

  it('shows the engine message and blocks locking when the spells cost too much', () => {
    const { s, view, group, onLock } = setup();
    const idx = s.state.players.red.hand.indexOf('rain-of-arrows');
    fireEvent.click(screen.getAllByRole('button', { name: /^Play / })[idx]);
    fireEvent.click(view.container.querySelector(`polygon[data-cell="${group.pos!.x},${group.pos!.y}"]`)!);
    expect(screen.getByRole('alert').textContent).toMatch(/not enough \w+ mana for Rain of Arrows/);
    const lockBtn = screen.getByRole('button', { name: /Lock orders/ }) as HTMLButtonElement;
    expect(lockBtn.disabled).toBe(true);
    fireEvent.click(lockBtn);
    expect(onLock).not.toHaveBeenCalled();
  });

  it('marks a hand card for discard', () => {
    const { view } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Discard Warlord' }));
    const list = view.container.querySelector('.orders-list') as HTMLElement;
    expect(within(list).getByText(/Discard Warlord/)).toBeTruthy();
  });

  it('locks the orders and shows an error that comes back', () => {
    const { onLock } = setup();
    onLock.mockReturnValueOnce('not enough strife mana for Fireball');
    fireEvent.click(screen.getByRole('button', { name: /Lock orders/ }));
    expect(screen.getByText(/not enough strife mana/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Lock orders/ }));
    expect(onLock).toHaveBeenCalledTimes(2);
  });
});
