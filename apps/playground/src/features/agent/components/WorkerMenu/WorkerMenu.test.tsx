import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';

import { WorkerMenu } from './WorkerMenu';

describe('WorkerMenu', () => {
  it('offers exactly one, three or six workers and calls the selected build limit', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<WorkerMenu locale="en" value={3} running={false} onChange={onChange} />);
    const select = screen.getByRole('combobox', { name: t('en', 'workers.label') });
    expect(select).toHaveValue('3');
    expect(screen.getAllByRole('option').map((option) => option.getAttribute('value'))).toEqual([
      '1',
      '3',
      '6',
    ]);
    await user.tab();
    expect(select).toHaveFocus();
    await user.selectOptions(select, '6');
    expect(onChange).toHaveBeenCalledExactlyOnceWith(6);
    expect(select).toHaveAccessibleDescription(t('en', 'workers.hint'));
  });

  it('locks the choice throughout an active run', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<WorkerMenu locale="en" value={1} running onChange={onChange} />);
    const select = screen.getByRole('combobox');
    expect(select).toBeDisabled();
    await user.selectOptions(select, '3');
    expect(onChange).not.toHaveBeenCalled();
    expect(select).toHaveValue('1');
  });

  it('uses Arabic labels and makes the build-only scope available to assistive technology', () => {
    render(<WorkerMenu locale="ar" value={6} running={false} onChange={vi.fn()} />);
    const select = screen.getByRole('combobox', { name: t('ar', 'workers.label') });
    expect(select).toHaveAccessibleDescription(t('ar', 'workers.hint'));
    expect(
      screen.getByRole('option', { name: t('ar', 'workers.option', { n: 6 }) }),
    ).toBeInTheDocument();
  });

  it('does not accept an out-of-contract option value', () => {
    const onChange = vi.fn();
    render(<WorkerMenu locale="en" value={3} running={false} onChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '99' } });
    expect(onChange).not.toHaveBeenCalled();
  });
});
