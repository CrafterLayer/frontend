import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { FieldServicesProvider } from '../field-services';
import { KeyValueField } from './KeyValueField';

afterEach(cleanup);

const props = (overrides: Record<string, unknown> = {}) => ({
  schema: z.record(z.string(), z.string().nullable()) as z.ZodType,
  value: { 'aria-label': 'Close', title: 'Dismiss' } as unknown,
  path: ['props', 'overrides', 0, 'attributes'],
  onChange: vi.fn(),
  ...overrides,
});

describe('KeyValueField', () => {
  it('shows each entry as a name and a value, never JSON', () => {
    render(<KeyValueField {...props()} />);
    expect(screen.getByRole('textbox', { name: 'Name 1' })).toHaveValue('aria-label');
    expect(screen.getByRole('textbox', { name: 'Value aria-label' })).toHaveValue('Close');
    expect(screen.getByRole('textbox', { name: 'Value title' })).toHaveAttribute('dir', 'auto');
    expect(document.body.textContent).not.toContain('{');
  });

  it('edits a value as ONE write of the whole record on blur', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeyValueField {...props({ onChange })} />);
    await user.type(screen.getByRole('textbox', { name: 'Value title' }), ' now');
    expect(onChange).not.toHaveBeenCalled();
    await user.tab();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ 'aria-label': 'Close', title: 'Dismiss now' });
  });

  it('refuses a rename onto a name already in use', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeyValueField {...props({ onChange })} />);
    const name = screen.getByRole('textbox', { name: 'Name 2' });
    await user.clear(name);
    await user.type(name, 'aria-label{Enter}');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('“aria-label” is already used.');
  });

  it('adds an entry once its row is left, and removes one', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeyValueField {...props({ onChange, value: {} })} />);
    expect(screen.getByText('Empty')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add entry' }));
    await user.keyboard('lang');
    await user.tab(); // into the value: still the same row, nothing written
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard('ar');
    await user.tab(); // out of the row
    expect(onChange).toHaveBeenCalledWith({ lang: 'ar' });

    cleanup();
    const onRemove = vi.fn();
    render(<KeyValueField {...props({ onChange: onRemove })} />);
    await user.click(screen.getByRole('button', { name: 'Remove title' }));
    expect(onRemove).toHaveBeenCalledWith({ 'aria-label': 'Close' });
  });

  it('labels itself in Arabic under an Arabic provider', () => {
    render(
      <FieldServicesProvider value={{ locale: 'ar' }}>
        <KeyValueField {...props()} />
      </FieldServicesProvider>,
    );
    expect(screen.getByRole('button', { name: 'إضافة سطر' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'الاسم 1' })).toBeInTheDocument();
  });
});
