import { fireEvent, render } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { Board } from '../src/ui/Board';
import { newSession } from '../src/model/session';

describe('Board', () => {
  const s = newSession(7, { red: 'war', blue: 'life' });

  it('draws every square, structure and group', () => {
    const { container } = render(<Board state={s.state} selected={null} highlights={new Set()} arrows={[]} onCell={() => {}} />);
    expect(container.querySelectorAll('polygon.tile')).toHaveLength(94);
    expect(container.querySelectorAll('.structure').length).toBe(Object.keys(s.state.structures).length);
    expect(container.querySelectorAll('.group-token').length).toBe(Object.values(s.state.groups).filter((g) => g.pos).length);
  });

  it('reports clicks, selection and highlights', () => {
    const onCell = vi.fn();
    const { container } = render(
      <Board state={s.state} selected={{ kind: 'square', pos: { x: 4, y: 4 } }} highlights={new Set(['5,4'])} arrows={[]} onCell={onCell} />,
    );
    const tile = container.querySelector('polygon[data-cell="5,4"]')!;
    expect(tile.getAttribute('class')).toContain('hl');
    expect(container.querySelector('polygon[data-cell="4,4"]')!.getAttribute('class')).toContain('selected');
    fireEvent.click(tile);
    expect(onCell).toHaveBeenCalledWith({ x: 5, y: 4 });
  });

  it('draws arrows', () => {
    const { container } = render(
      <Board state={s.state} selected={null} highlights={new Set()} arrows={[{ from: { x: 2, y: 2 }, to: { x: 3, y: 2 }, owner: 'red' }]} onCell={() => {}} />,
    );
    expect(container.querySelectorAll('line.arrow')).toHaveLength(1);
  });
});
