import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../src/app';

describe('app', () => {
  afterEach(cleanup);

  it('opens on the setup screen', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /sanctum/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Start game/ })).toBeTruthy();
  });
});
