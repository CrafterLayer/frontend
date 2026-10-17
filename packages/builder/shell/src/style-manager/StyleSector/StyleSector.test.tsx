import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StyleSector } from './StyleSector';

afterEach(cleanup);

describe('StyleSector', () => {
  it('is a disclosure: expanded shows a labelled region, collapsed unmounts it', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const { rerender } = render(
      <StyleSector title="Spacing" expanded onToggle={onToggle}>
        <p>rows</p>
      </StyleSector>,
    );
    const toggle = screen.getByRole('button', { name: 'Spacing' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: 'Spacing' })).toHaveTextContent('rows');
    await user.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(
      <StyleSector title="Spacing" expanded={false} onToggle={onToggle}>
        <p>rows</p>
      </StyleSector>,
    );
    expect(screen.queryByText('rows')).not.toBeInTheDocument();
  });
});

describe('StyleSector count', () => {
  it('shows how many values are set here without changing the toggle name', () => {
    render(
      <StyleSector title="Layout" expanded={false} onToggle={vi.fn()} count={2} countLabel="2 set here">
        <p>rows</p>
      </StyleSector>,
    );
    const toggle = screen.getByRole('button', { name: 'Layout' });
    expect(toggle).toHaveAccessibleDescription('2 set here');
    expect(toggle).toHaveTextContent('2');
  });

  it('a sector with nothing set shows no count', () => {
    render(
      <StyleSector title="Layout" expanded onToggle={vi.fn()} count={0} countLabel="0 set here">
        <p>rows</p>
      </StyleSector>,
    );
    expect(screen.getByRole('button', { name: 'Layout' })).not.toHaveAccessibleDescription();
  });
});
