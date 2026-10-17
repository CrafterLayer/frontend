import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { StylePanelFilter } from './StylePanelFilter';

afterEach(cleanup);

const labels = { filter: 'Filter properties', filterPlaceholder: 'Find a property…', clearFilter: 'Clear filter' };

function Harness() {
  const [query, setQuery] = useState('');
  return (
    <>
      <StylePanelFilter query={query} onQueryChange={setQuery} labels={labels} />
      <output>{query}</output>
    </>
  );
}

describe('StylePanelFilter', () => {
  it('reports what is typed; the clear button empties it and returns focus to the field', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = screen.getByRole('searchbox', { name: 'Filter properties' });
    expect(screen.queryByRole('button', { name: 'Clear filter' })).not.toBeInTheDocument();
    await user.type(field, 'rad');
    expect(screen.getByRole('status')).toHaveTextContent('rad');
    await user.click(screen.getByRole('button', { name: 'Clear filter' }));
    expect(field).toHaveValue('');
    expect(field).toHaveFocus();
  });

  it('Escape clears a filled field', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const field = screen.getByRole('searchbox', { name: 'Filter properties' });
    await user.type(field, 'gap{Escape}');
    expect(field).toHaveValue('');
  });
});
