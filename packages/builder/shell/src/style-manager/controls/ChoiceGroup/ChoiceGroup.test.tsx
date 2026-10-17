import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChoiceGroup } from './ChoiceGroup';

afterEach(cleanup);

const OPTIONS = [
  { value: 'block', label: 'Block' },
  { value: 'flex', label: 'Flex' },
  { value: 'grid', label: 'Grid' },
];

describe('ChoiceGroup', () => {
  it('is one radio group with one tab stop on the checked option', () => {
    render(<ChoiceGroup label="Display" options={OPTIONS} value="flex" onChange={vi.fn()} dir="ltr" />);
    const radios = screen.getAllByRole('radio');
    expect(screen.getByRole('radiogroup', { name: 'Display' })).toBeInTheDocument();
    expect(radios.map((radio) => radio.tabIndex)).toEqual([-1, 0, -1]);
    expect(screen.getByRole('radio', { name: 'Flex' })).toHaveAttribute('aria-checked', 'true');
  });

  it('commits the next option on an arrow key, mirrored in RTL', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ChoiceGroup label="Display" options={OPTIONS} value="block" onChange={onChange} dir="rtl" />);
    screen.getByRole('radio', { name: 'Block' }).focus();
    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenCalledWith('flex');
    expect(screen.getByRole('radio', { name: 'Flex' })).toHaveFocus();
  });

  it('does not write again when the checked option is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ChoiceGroup label="Display" options={OPTIONS} value="grid" onChange={onChange} dir="ltr" />);
    await user.click(screen.getByRole('radio', { name: 'Grid' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('checks nothing and says Mixed when the targets disagree', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ChoiceGroup label="Display" options={OPTIONS} value="grid" mixed onChange={onChange} dir="ltr" />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Display (Mixed)' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { checked: true })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Grid' }));
    expect(onChange).toHaveBeenCalledWith('grid');
  });
});
