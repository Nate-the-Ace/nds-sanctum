import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../src/app';

const click = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('app flow', () => {
  afterEach(cleanup);

  it('plays three empty turns through the hand-offs', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/Mode/), { target: { value: 'hotseat' } });
    click(/Start game/);
    for (let turn = 1; turn <= 3; turn++) {
      expect(screen.getByText(/Pass the device to Red/)).toBeTruthy();
      click(/I'm ready/);
      expect(screen.getByRole('heading', { name: new RegExp(`Red's orders · Turn ${turn}`) })).toBeTruthy();
      click(/Lock orders/);
      expect(screen.getByText(/Pass the device to Blue/)).toBeTruthy();
      click(/I'm ready/);
      click(/Lock orders/);
      expect(screen.getByRole('heading', { name: new RegExp(`Turn ${turn} report`) })).toBeTruthy();
      click(/Next turn/);
    }
    expect(screen.getByText(/Pass the device to Red/)).toBeTruthy();
  });

  it('switches to the card browser and back', () => {
    render(<App />);
    click(/^Cards$/);
    expect(screen.getByRole('heading', { name: /Card browser/ })).toBeTruthy();
    click(/^Play$/);
    expect(screen.getByRole('button', { name: /Start game/ })).toBeTruthy();
  });
});
