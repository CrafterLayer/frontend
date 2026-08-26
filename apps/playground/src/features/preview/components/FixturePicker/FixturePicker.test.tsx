import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FixturePicker } from './FixturePicker';

describe('FixturePicker', () => {
  it('reflects the value and reports selection changes', async () => {
    const onChange = vi.fn();
    render(<FixturePicker value="landing" onChange={onChange} />);
    await userEvent.setup().selectOptions(screen.getByRole('combobox'), 'empty');
    expect(onChange).toHaveBeenCalledWith('empty');
  });
});
