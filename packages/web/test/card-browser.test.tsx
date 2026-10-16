import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { CardBrowser } from '../src/ui/CardBrowser';

describe('CardBrowser', () => {
  afterEach(cleanup);

  it('lists cards with keyword text and filters by search', () => {
    render(<CardBrowser />);
    expect(screen.getByText('Flaming Sword')).toBeTruthy();
    fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'fireball' } });
    expect(screen.getByText('Fireball')).toBeTruthy();
    expect(screen.queryByText('Flaming Sword')).toBeNull();
  });
  it('keeps what was typed so multi-word searches can be entered', () => {
    render(<CardBrowser />);
    const box = screen.getByRole('searchbox') as HTMLInputElement;
    fireEvent.input(box, { target: { value: 'Flaming ' } });
    expect(box.value).toBe('Flaming ');
    fireEvent.input(box, { target: { value: 'Flaming Sword' } });
    expect(screen.getByText('Flaming Sword')).toBeTruthy();
    expect(screen.queryByText('Fireball')).toBeNull();
  });
  it('shows the glossary', () => {
    render(<CardBrowser />);
    expect(screen.getByRole('heading', { name: /Keywords/ })).toBeTruthy();
  });
});
