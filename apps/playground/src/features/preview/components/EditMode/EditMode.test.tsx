import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { EditMode } from './EditMode';

function Host() {
  const [value, setValue] = useState(false);
  return (
    <>
      <EditMode value={value} onChange={setValue} />
      <output>{value ? 'editing' : 'previewing'}</output>
    </>
  );
}

describe('EditMode', () => {
  it('toggles through its accessible checkbox', async () => {
    const user = userEvent.setup();
    render(<Host />);
    expect(screen.getByRole('status')).toHaveTextContent('previewing');

    await user.click(screen.getByRole('checkbox', { name: 'Edit mode' }));
    expect(screen.getByRole('status')).toHaveTextContent('editing');

    await user.click(screen.getByRole('checkbox', { name: 'Edit mode' }));
    expect(screen.getByRole('status')).toHaveTextContent('previewing');
  });
});
