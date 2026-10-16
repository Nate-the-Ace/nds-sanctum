import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { App } from '../src/app';

describe('app', () => {
  it('renders the title and the number of implemented cards', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /sanctum/i })).toBeTruthy();
    expect(screen.getByText(/78 cards/)).toBeTruthy();
  });
});
