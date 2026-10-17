import { render } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';

import { usePinnedColumn } from './pin-column';

function Destination({ active }: { readonly active: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  usePinnedColumn(ref, active);
  return <div ref={ref} className="pg-rail-panel" />;
}

function columnOf(container: HTMLElement): HTMLElement {
  const column = container.querySelector<HTMLElement>('.bldr-shell__panel');
  if (column === null) throw new Error('No column.');
  return column;
}

function mount(active: boolean, scrolledTo = 0) {
  const column = document.createElement('div');
  column.className = 'bldr-shell__panel';
  column.scrollTop = scrolledTo;
  document.body.append(column);
  const view = render(<Destination active={active} />, { container: column });
  return { column, ...view };
}

describe('usePinnedColumn', () => {
  it('opens the Assistant at the top of a column another destination left scrolled', () => {
    const { column } = mount(true, 1867);
    expect(column.scrollTop).toBe(0);
  });

  it('puts the column back whenever something scrolls it while the Assistant shows', () => {
    const { column } = mount(true);
    column.scrollTop = 400;
    column.dispatchEvent(new Event('scroll'));
    expect(column.scrollTop).toBe(0);
  });

  it('leaves the column alone for every other destination', () => {
    const { column, rerender } = mount(false, 300);
    column.dispatchEvent(new Event('scroll'));
    expect(column.scrollTop).toBe(300);
    rerender(<Destination active />);
    expect(columnOf(document.body).scrollTop).toBe(0);
    rerender(<Destination active={false} />);
    column.scrollTop = 120;
    column.dispatchEvent(new Event('scroll'));
    expect(column.scrollTop).toBe(120);
  });
});
