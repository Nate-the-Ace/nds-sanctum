import { describe, it, expect } from 'vitest';
import { ENGINE_VERSION } from '../src/index';

describe('scaffold', () => {
  it('loads the engine package', () => {
    expect(ENGINE_VERSION).toBe('0.1.0');
  });
});
