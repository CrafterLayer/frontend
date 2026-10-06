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
