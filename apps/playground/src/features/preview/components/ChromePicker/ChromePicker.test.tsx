import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { chromeThemeFor } from './chrome-theme';
import { ChromePicker } from './ChromePicker';

describe('ChromePicker', () => {
  it('reflects the value and reports changes', async () => {
    const onChange = vi.fn();
    render(<ChromePicker value="system" onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Editor system' })).toBeChecked();

    await userEvent.setup().click(screen.getByRole('radio', { name: 'Editor dark' }));
    expect(onChange).toHaveBeenCalledWith('dark');
  });

  it('offers the machine as a state a person can return to', () => {
    render(<ChromePicker value="dark" onChange={vi.fn()} />);
    // Three radios, not two: a control that could only say light-or-dark would
    // have no way back to "whatever this machine says", which is where every
    // viewer starts.
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'Editor system' })).not.toBeChecked();
  });

  it('translates the choice into what BuilderTheme means by it', () => {
    // `undefined` is the whole point: omitting the prop is what lets the
    // stylesheet's prefers-color-scheme block answer. A `system` that mapped to
    // 'light' would silently override a dark machine.
    expect(chromeThemeFor('system')).toBeUndefined();
    expect(chromeThemeFor('light')).toBe('light');
    expect(chromeThemeFor('dark')).toBe('dark');
  });

  it('speaks the editor language when given its words', () => {
    render(
      <ChromePicker
        value="dark"
        onChange={vi.fn()}
        labels={{
          legend: 'المظهر',
          choices: { system: 'النظام', light: 'فاتح', dark: 'داكن' },
          optionName: (choice) => `المحرر: ${choice}`,
        }}
      />,
    );
    expect(screen.getByRole('group', { name: 'المظهر' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'المحرر: داكن' })).toBeChecked();
  });
});
