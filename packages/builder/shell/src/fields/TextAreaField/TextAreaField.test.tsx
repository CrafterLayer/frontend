import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { TextAreaField } from './TextAreaField';

afterEach(cleanup);

const props = (overrides: Record<string, unknown> = {}) => ({
  schema: z.string() as z.ZodType,
  value: 'First line' as unknown,
  path: ['props', 'body'],
  onChange: vi.fn(),
  controlId: 'body',
  ...overrides,
});

describe('TextAreaField', () => {
  it('is a multi-line box that follows its own text direction', () => {
    render(<TextAreaField {...props()} />);
    const box = screen.getByRole('textbox');
    expect(box.tagName).toBe('TEXTAREA');
    expect(box).toHaveAttribute('dir', 'auto');
    expect(box).toHaveAttribute('id', 'body');
    expect(box).toHaveValue('First line');
  });

  it('commits each change; Shift+Enter is a line break, Enter is not', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TextAreaField {...props({ onChange })} />);
    const box = screen.getByRole('textbox');
    await user.type(box, '{Shift>}{Enter}{/Shift}Second');
    expect(onChange).toHaveBeenLastCalledWith('First line\nSecond');
    await user.type(box, '{Enter}');
    expect(box).toHaveValue('First line\nSecond');
  });

  it('keeps a rejected draft visible and lets an external write win', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const view = render(<TextAreaField {...props({ onChange })} />);
    await user.clear(screen.getByRole('textbox'));
    expect(screen.getByRole('textbox')).toHaveValue('');
    view.rerender(<TextAreaField {...props({ onChange, value: 'Undone' })} />);
    expect(screen.getByRole('textbox')).toHaveValue('Undone');
  });

  it('shows the inherited placeholder and honours disabled', () => {
    render(<TextAreaField {...props({ value: undefined, placeholder: 'Base', disabled: true })} />);
    const box = screen.getByRole('textbox');
    expect(box).toHaveAttribute('placeholder', 'Base');
    expect(box).toBeDisabled();
  });
});
