import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { Sidebar } from '../src/ui/Sidebar';
import { newSession } from '../src/model/session';

describe('Sidebar', () => {
  const s = newSession(7, { red: 'war', blue: 'life' });
  const group = Object.values(s.state.groups).find((g) => g.owner === 'red')!;

  it('shows a group and its minion tiles with stats', () => {
    render(<Sidebar state={s.state} cards={s.cards} selected={{ kind: 'group', id: group.id }} />);
    expect(screen.getByText(/Red group/)).toBeTruthy();
    expect(screen.getAllByText(/Human/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/7\/7/).length).toBe(4);
    expect(screen.getAllByText(/H 2/).length).toBeGreaterThan(0);
  });

  it('shows a structure with its novices', () => {
    const st = Object.values(s.state.structures).find((x) => x.kind === 'sanctum' && x.owner === 'red')!;
    render(<Sidebar state={s.state} cards={s.cards} selected={{ kind: 'structure', id: st.id }} />);
    expect(screen.getByText(/Sanctum/)).toBeTruthy();
    expect(screen.getByText(new RegExp(`${st.novices} novice`))).toBeTruthy();
  });

  it('shows a square and a spell with its keyword text', () => {
    const e = JSON.parse(JSON.stringify(s.state));
    e.spells.push({ id: 9999, cardId: 'flaming-sword', owner: 'red', host: { kind: 'minion', id: group.minionIds[0] }, visible: true, turnsLeft: null, tokens: {} });
    render(<Sidebar state={e} cards={s.cards} selected={{ kind: 'group', id: group.id }} />);
    expect(screen.getByText('Flaming Sword')).toBeTruthy();
    expect(screen.getByText(/\+2 H/)).toBeTruthy();
  });

  it('shows a square', () => {
    render(<Sidebar state={s.state} cards={s.cards} selected={{ kind: 'square', pos: { x: 4, y: 4 } }} />);
    expect(screen.getByText(/Square \(5,5\)/)).toBeTruthy();
  });
});
