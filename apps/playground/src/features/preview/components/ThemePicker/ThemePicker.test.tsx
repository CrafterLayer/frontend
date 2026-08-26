import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ThemePicker } from './ThemePicker';

describe('ThemePicker', () => {
  it('reflects the value and reports changes', async () => {
    const onChange = vi.fn();
    render(<ThemePicker value="light" onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'light' })).toBeChecked();

    await userEvent.setup().click(screen.getByRole('radio', { name: 'dark' }));
    expect(onChange).toHaveBeenCalledWith('dark');
  });
});
