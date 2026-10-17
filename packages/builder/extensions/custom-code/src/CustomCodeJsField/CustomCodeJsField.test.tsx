import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { FieldProps } from '@craftkit/builder-schema';

import CustomCodeJsField from './CustomCodeJsField';

function renderField(overrides: Partial<FieldProps> = {}) {
  const onChange = vi.fn();
  const props: FieldProps = {
    schema: z.string(),
    value: '',
    path: ['props', 'js'],
    onChange,
    ...overrides,
  };
  render(<CustomCodeJsField {...props} />);
  return { onChange, field: screen.getByRole('textbox', { name: 'Custom JS' }) };
}

describe('CustomCodeJsField', () => {
  it('shows the stored script', () => {
    const { field } = renderField({ value: 'ck.root.dataset.on = "1";' });
    expect(field).toHaveValue('ck.root.dataset.on = "1";');
  });

  it('shows an empty box for a value that is not a string', () => {
    expect(renderField({ value: null }).field).toHaveValue('');
  });

  it('says what the script receives', () => {
    renderField();
    expect(screen.getByText(/Receives/u)).toHaveTextContent('ck.stage()');
  });

  it('commits ONE change per edit session, not one per keystroke', async () => {
    const { onChange, field } = renderField();
    await userEvent.type(field, 'let a = 1');
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledExactlyOnceWith('let a = 1');
  });

  it('stores code verbatim: no refusal, no stripping', async () => {
    const { onChange, field } = renderField();
    await userEvent.type(field, 'document.write("<b>x</b>")');
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledExactlyOnceWith('document.write("<b>x</b>")');
  });

  it('commits nothing when the text came back unchanged', async () => {
    const { onChange, field } = renderField({ value: 'ck.onDispose(() => {});' });
    await userEvent.click(field);
    await userEvent.tab();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is closed by the host', () => {
    expect(renderField({ disabled: true }).field).toBeDisabled();
  });
});
